import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";

export const auditRouter = Router();

const EventSchema = z.object({
  event_type:  z.string().min(1),
  contract_id: z.string().uuid().optional(),
  agent:       z.string().optional(),
  confidence:  z.number().min(0).max(1).optional(),
  payload:     z.record(z.any()).optional(),
  user_id:     z.string().optional(),
});

// ── POST /api/audit — record an event ─────────────────────────────────────────
auditRouter.post("/", async (req, res, next) => {
  try {
    const parsed = EventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    const { event_type, contract_id, agent, confidence, payload, user_id } = parsed.data;
    const { rows } = await query(
      `INSERT INTO audit_events (event_type, contract_id, agent, confidence, payload, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [event_type, contract_id ?? null, agent ?? null, confidence ?? null,
       payload ? JSON.stringify(payload) : null, user_id ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// ── GET /api/audit?contract_id=...&limit=50 ───────────────────────────────────
auditRouter.get("/", async (req, res, next) => {
  try {
    const contractId = req.query.contract_id as string | undefined;
    const limit = Math.min(500, Number(req.query.limit ?? 100));
    const sql = contractId
      ? `SELECT * FROM audit_events WHERE contract_id = $1 ORDER BY ts DESC LIMIT $2`
      : `SELECT * FROM audit_events ORDER BY ts DESC LIMIT $1`;
    const vals = contractId ? [contractId, limit] : [limit];
    const { rows } = await query(sql, vals);
    res.json(rows);
  } catch (e) { next(e); }
});
