// Lightweight idempotent migrations applied at server boot. Anything in
// docker/init.sql is the source of truth for fresh containers; this file is
// the safety net so existing dev databases pick up new tables without a reset.
import { pool } from "../db.js";

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "noah_kb",
    sql: `
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE TABLE IF NOT EXISTS noah_kb (
        id          TEXT PRIMARY KEY,
        content     TEXT NOT NULL,
        embedding   VECTOR(768),
        title       TEXT NOT NULL,
        topic       TEXT NOT NULL,
        keywords    TEXT[] NOT NULL DEFAULT '{}',
        metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_noah_kb_embedding ON noah_kb USING hnsw (embedding vector_cosine_ops);
      CREATE INDEX IF NOT EXISTS idx_noah_kb_topic     ON noah_kb(topic);
      CREATE INDEX IF NOT EXISTS idx_noah_kb_keywords  ON noah_kb USING gin(keywords);
    `,
  },
];

export async function applyMigrations(): Promise<void> {
  for (const m of MIGRATIONS) {
    try {
      await pool.query(m.sql);
    } catch (e) {
      console.error(`Migration "${m.name}" failed:`, e);
      throw e;
    }
  }
}
