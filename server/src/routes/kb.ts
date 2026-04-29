import { Router } from "express";
import pgvector from "pgvector";
import { z } from "zod";
import { query } from "../db.js";
import { embed } from "../lib/embeddings.js";

export const kbRouter = Router();

// ── POST /api/kb/search — cosine search; returns top-K chunks ────────────────
const SearchSchema = z.object({
  query: z.string().min(2),
  topK: z.number().int().min(1).max(20).default(5),
  topic: z.string().optional(),
});

kbRouter.post("/search", async (req, res, next) => {
  try {
    const parsed = SearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    }
    const { query: q, topK, topic } = parsed.data;
    const vec = await embed(q);
    const params: unknown[] = [pgvector.toSql(vec), topK];
    let where = "WHERE embedding IS NOT NULL";
    if (topic) {
      where += " AND topic = $3";
      params.push(topic);
    }
    const sql = `
      SELECT id, title, topic, content, keywords,
             1 - (embedding <=> $1::vector) AS similarity
      FROM noah_kb
      ${where}
      ORDER BY embedding <=> $1::vector
      LIMIT $2`;
    const { rows } = await query(sql, params);
    res.json({ query: q, results: rows });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/kb/all — full table dump for client-side fallback ──────────────
kbRouter.get("/all", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, topic, content, keywords FROM noah_kb ORDER BY topic, id`
    );
    res.json({ chunks: rows });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/kb/topics — distinct topics ─────────────────────────────────────
kbRouter.get("/topics", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT topic, COUNT(*)::int AS chunk_count
       FROM noah_kb
       GROUP BY topic
       ORDER BY topic`
    );
    res.json({ topics: rows });
  } catch (e) {
    next(e);
  }
});
