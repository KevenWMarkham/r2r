import { Router } from "express";
import pgvector from "pgvector";
import { z } from "zod";
import { query } from "../db.js";
import { embed } from "../lib/embeddings.js";

export const searchRouter = Router();

// ── POST /api/search/semantic — nearest-neighbor search via cosine distance ────
//    Body: { query: string, limit?: number }
const SemanticSchema = z.object({
  query: z.string().min(3),
  limit: z.number().int().min(1).max(50).default(5),
});

searchRouter.post("/semantic", async (req, res, next) => {
  try {
    const parsed = SemanticSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

    const { query: q, limit } = parsed.data;
    const vec = await embed(q);
    const sql = `
      SELECT c.id, c.filename, c.file_type, c.byte_size,
             m.risk_category, m.risk_score,
             m.attributes->>'counterparty' AS counterparty,
             m.attributes->>'contract_type' AS contract_type,
             1 - (m.embedding <=> $1::vector) AS similarity
      FROM contract_metabase m
      JOIN contracts c ON c.id = m.contract_id
      WHERE m.embedding IS NOT NULL
      ORDER BY m.embedding <=> $1::vector
      LIMIT $2`;
    const { rows } = await query(sql, [pgvector.toSql(vec), limit]);
    res.json({ query: q, results: rows });
  } catch (e) { next(e); }
});

// ── POST /api/search/similar — find contracts similar to a given one ───────────
searchRouter.post("/similar/:contractId", async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const limit = Math.min(20, Number(req.body?.limit ?? 5));

    // Get that contract's embedding
    const { rows: srcRows } = await query(
      `SELECT embedding FROM contract_metabase WHERE contract_id = $1`,
      [contractId]
    );
    if (srcRows.length === 0 || !srcRows[0].embedding) {
      return res.status(404).json({ error: "Source contract has no embedding" });
    }

    const srcEmbedding = pgvector.toSql(srcRows[0].embedding);
    const sql = `
      SELECT c.id, c.filename, m.risk_category,
             m.attributes->>'counterparty' AS counterparty,
             1 - (m.embedding <=> $1::vector) AS similarity
      FROM contract_metabase m
      JOIN contracts c ON c.id = m.contract_id
      WHERE m.contract_id != $2 AND m.embedding IS NOT NULL
      ORDER BY m.embedding <=> $1::vector
      LIMIT $3`;
    const { rows } = await query(sql, [srcEmbedding, contractId, limit]);
    res.json({ contract_id: contractId, results: rows });
  } catch (e) { next(e); }
});

// ── GET /api/search/attributes?key=value ───────────────────────────────────────
//    Structured search on the JSONB attributes column.
searchRouter.get("/attributes", async (req, res, next) => {
  try {
    const entries = Object.entries(req.query).filter(([_, v]) => typeof v === "string");
    if (entries.length === 0) return res.status(400).json({ error: "Provide at least one ?key=value pair" });

    const conditions: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const [k, v] of entries) {
      conditions.push(`m.attributes->>${i} = ${i + 1}`.replace(new RegExp(`\\$(\\d+)`, "g"), "$$$1"));
      conditions[conditions.length - 1] = `(m.attributes->>$${i})::text = $${i + 1}`;
      vals.push(k, String(v));
      i += 2;
    }
    const sql = `SELECT c.id, c.filename, m.attributes, m.risk_category
                 FROM contract_metabase m JOIN contracts c ON c.id = m.contract_id
                 WHERE ${conditions.join(" AND ")}
                 LIMIT 50`;
    const { rows } = await query(sql, vals);
    res.json({ filters: Object.fromEntries(entries), results: rows });
  } catch (e) { next(e); }
});
