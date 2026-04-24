import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { routeForApproval, type MaterialityTier } from "../lib/je-materiality.js";
import { assertTransition, IllegalTransitionError, type JEStatus } from "../lib/je-state.js";
import { postToSAPviaBlackLine, nextReversalDocNum } from "../lib/posting-agent.js";

export const jeRouter = Router();

// ── POST /api/je — create new submitted JE ──────────────────────────────────
const CreateSchema = z.object({
  contract_id: z.string().uuid(),
  period: z.string(),
  je_body: z.record(z.any()),
  total_amount: z.number(),
  reversal_date: z.string(),     // ISO date
  prepared_by: z.string().default("Marcus"),
});

jeRouter.post("/", async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    const { contract_id, period, je_body, total_amount, reversal_date, prepared_by } = parsed.data;
    const { tier, approver } = routeForApproval(total_amount);

    const { rows } = await query(
      `INSERT INTO proposed_journal_entries
         (contract_id, status, period, je_body, materiality_tier, total_amount,
          prepared_by, submitted_at, reversal_date)
       VALUES ($1, 'submitted', $2, $3, $4, $5, $6, NOW(), $7)
       RETURNING *`,
      [contract_id, period, JSON.stringify(je_body), tier, total_amount, prepared_by, reversal_date]
    );
    const je = rows[0];

    // Audit — submission event
    await query(
      `INSERT INTO audit_events (event_type, contract_id, agent, payload, user_id)
       VALUES ('je_submit', $1, 'marcus', $2::jsonb, $3)`,
      [contract_id, JSON.stringify({ je_id: je.id, amount: total_amount, tier, routed_to: approver }), prepared_by]
    );

    // Auto-approve path — if tier is 'standard', flip straight through to approved → posted
    if (tier === "standard") {
      await autoApproveAndPost(je.id, contract_id, "auto-approve");
      const { rows: refreshed } = await query(`SELECT * FROM proposed_journal_entries WHERE id = $1`, [je.id]);
      return res.status(201).json(refreshed[0]);
    }

    res.status(201).json(je);
  } catch (e) { next(e); }
});

// ── GET /api/je/queue?tier=manager — review queue ───────────────────────────
jeRouter.get("/queue", async (req, res, next) => {
  try {
    const tier = req.query.tier as MaterialityTier | undefined;
    const sql = tier
      ? `SELECT p.*, c.filename, c.id AS c_id,
                (c.id) AS c_contract_id,
                m.attributes->>'counterparty' AS counterparty
         FROM proposed_journal_entries p
         JOIN contracts c ON c.id = p.contract_id
         LEFT JOIN contract_metabase m ON m.contract_id = c.id
         WHERE p.status = 'submitted' AND p.materiality_tier = $1
         ORDER BY p.submitted_at ASC`
      : `SELECT p.*, c.filename, c.id AS c_id,
                m.attributes->>'counterparty' AS counterparty
         FROM proposed_journal_entries p
         JOIN contracts c ON c.id = p.contract_id
         LEFT JOIN contract_metabase m ON m.contract_id = c.id
         WHERE p.status = 'submitted'
         ORDER BY p.submitted_at ASC`;
    const { rows } = await query(sql, tier ? [tier] : []);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET /api/je/:id — single JE ─────────────────────────────────────────────
jeRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.filename,
              m.attributes->>'counterparty' AS counterparty
       FROM proposed_journal_entries p
       JOIN contracts c ON c.id = p.contract_id
       LEFT JOIN contract_metabase m ON m.contract_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── GET /api/je/by-contract/:contractId — full JE history ──────────────────
jeRouter.get("/by-contract/:contractId", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM proposed_journal_entries WHERE contract_id = $1 ORDER BY created_at DESC`,
      [req.params.contractId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// ── POST /api/je/:id/approve ────────────────────────────────────────────────
const ApproveSchema = z.object({ approved_by: z.string().default("Rachel") });

jeRouter.post("/:id/approve", async (req, res, next) => {
  try {
    const { approved_by } = ApproveSchema.parse(req.body ?? {});
    const { rows } = await query(`SELECT * FROM proposed_journal_entries WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const je = rows[0];

    try { assertTransition(je.status as JEStatus, "approved"); }
    catch (e) { if (e instanceof IllegalTransitionError) return res.status(409).json({ error: e.message }); throw e; }

    await autoApproveAndPost(je.id, je.contract_id, approved_by);

    const { rows: refreshed } = await query(`SELECT * FROM proposed_journal_entries WHERE id = $1`, [req.params.id]);
    res.json(refreshed[0]);
  } catch (e) { next(e); }
});

// Shared helper: approve → post → write audit events
async function autoApproveAndPost(jeId: string, contractId: string, approvedBy: string): Promise<void> {
  // Transition → approved
  await query(
    `UPDATE proposed_journal_entries
     SET status = 'approved', approved_by = $2, approved_at = NOW()
     WHERE id = $1`,
    [jeId, approvedBy]
  );
  await query(
    `INSERT INTO audit_events (event_type, contract_id, agent, payload, user_id)
     VALUES ('je_approve', $1, 'review', $2::jsonb, $3)`,
    [contractId, JSON.stringify({ je_id: jeId, approved_by: approvedBy }), approvedBy]
  );

  // Fire Posting Agent
  const result = await postToSAPviaBlackLine(jeId);

  // Transition → posted
  await query(
    `UPDATE proposed_journal_entries
     SET status = 'posted', posted_at = NOW(), posting_ref = $2
     WHERE id = $1`,
    [jeId, result.posting_ref]
  );
  await query(
    `INSERT INTO audit_events (event_type, contract_id, agent, payload)
     VALUES ('je_post', $1, 'posting-agent', $2::jsonb)`,
    [contractId, JSON.stringify({ je_id: jeId, posting_ref: result.posting_ref, latency_ms: result.latency_ms })]
  );
}

// ── POST /api/je/:id/reject ─────────────────────────────────────────────────
const RejectSchema = z.object({
  rejected_by: z.string().default("Rachel"),
  reason: z.string().min(1),
});

jeRouter.post("/:id/reject", async (req, res, next) => {
  try {
    const { rejected_by, reason } = RejectSchema.parse(req.body);
    const { rows } = await query(`SELECT * FROM proposed_journal_entries WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const je = rows[0];

    try { assertTransition(je.status as JEStatus, "rejected"); }
    catch (e) { if (e instanceof IllegalTransitionError) return res.status(409).json({ error: e.message }); throw e; }

    await query(
      `UPDATE proposed_journal_entries
       SET status = 'rejected', rejected_by = $2, rejected_at = NOW(), rejected_reason = $3
       WHERE id = $1`,
      [req.params.id, rejected_by, reason]
    );
    await query(
      `INSERT INTO audit_events (event_type, contract_id, agent, payload, user_id)
       VALUES ('je_reject', $1, 'review', $2::jsonb, $3)`,
      [je.contract_id, JSON.stringify({ je_id: je.id, reason }), rejected_by]
    );

    const { rows: refreshed } = await query(`SELECT * FROM proposed_journal_entries WHERE id = $1`, [req.params.id]);
    res.json(refreshed[0]);
  } catch (e) { next(e); }
});

// ── POST /api/je/run-reversals — simulate month-end reversal batch ─────────
jeRouter.post("/run-reversals", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, contract_id FROM proposed_journal_entries
       WHERE status = 'posted' AND reversal_date <= CURRENT_DATE`
    );
    const reversed: Array<{ id: string; reversal_ref: string }> = [];
    for (const r of rows) {
      const ref = nextReversalDocNum();
      await query(
        `UPDATE proposed_journal_entries
         SET status = 'reversed', reversed_at = NOW(), reversal_ref = $2
         WHERE id = $1`,
        [r.id, ref]
      );
      await query(
        `INSERT INTO audit_events (event_type, contract_id, agent, payload)
         VALUES ('je_reversal', $1, 'sap-auto', $2::jsonb)`,
        [r.contract_id, JSON.stringify({ je_id: r.id, reversal_ref: ref })]
      );
      reversed.push({ id: r.id, reversal_ref: ref });
    }
    res.json({ count: reversed.length, reversed });
  } catch (e) { next(e); }
});
