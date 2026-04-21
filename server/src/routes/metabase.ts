import { Router } from "express";
import { query } from "../db.js";
import { z } from "zod";

export const metabaseRouter = Router();

// ── PATCH /api/metabase/:contractId — update extracted metadata as agents finish ──
const PatchSchema = z.object({
  attributes:      z.record(z.any()).optional(),
  risk_score:      z.number().int().min(0).max(100).optional(),
  risk_category:   z.enum(["High", "Medium", "Low"]).optional(),
  risk_reasons:    z.array(z.any()).optional(),
  tech_acct_flags: z.record(z.any()).optional(),
  proposed_je:     z.record(z.any()).optional(),
  narrative:       z.record(z.any()).optional(),
  agent_status:    z.record(z.string()).optional(),
});

metabaseRouter.patch("/:contractId", async (req, res, next) => {
  try {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

    const patch = parsed.data;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(patch)) {
      sets.push(`${k} = $${i++}`);
      vals.push(typeof v === "object" ? JSON.stringify(v) : v);
    }
    if (sets.length === 0) return res.status(400).json({ error: "Empty patch" });

    vals.push(req.params.contractId);
    const sql = `UPDATE contract_metabase SET ${sets.join(", ")}, updated_at = NOW()
                 WHERE contract_id = $${i} RETURNING *`;
    const { rows } = await query(sql, vals);
    if (rows.length === 0) return res.status(404).json({ error: "Metabase row not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── GET /api/metabase — full metabase dump (no blobs, no embeddings, no full_text) ──
metabaseRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.id, m.contract_id, c.filename,
              m.attributes, m.risk_score, m.risk_category, m.risk_reasons,
              m.tech_acct_flags, m.proposed_je, m.narrative, m.agent_status,
              m.created_at, m.updated_at
       FROM contract_metabase m
       JOIN contracts c ON c.id = m.contract_id
       ORDER BY m.updated_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});
