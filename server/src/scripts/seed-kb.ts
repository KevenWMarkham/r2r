// Seed the noah_kb table from fixtures/kb-chunks.json (the shared source of
// truth used by canned mode + live mode).
//
// Usage: pnpm --filter noah-prototype-server seed:kb
//        (or: cd server && pnpm seed:kb)
// Requires: Postgres reachable + Ollama running with nomic-embed-text pulled.

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pgvector from "pgvector";
import { pool } from "../db.js";
import { embed } from "../lib/embeddings.js";
import { applyMigrations } from "../lib/migrations.js";

interface KBChunk {
  id: string;
  title: string;
  topic: string;
  content: string;
  keywords: string[];
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  // server/src/scripts → ../../../fixtures/kb-chunks.json
  const jsonPath = resolve(here, "..", "..", "..", "fixtures", "kb-chunks.json");
  const raw = await readFile(jsonPath, "utf8");
  const chunks: KBChunk[] = JSON.parse(raw);

  console.log(`Seeding noah_kb from ${chunks.length} chunk${chunks.length === 1 ? "" : "s"} (${jsonPath})…`);

  await applyMigrations();
  await pool.query(`TRUNCATE noah_kb`);

  let inserted = 0;
  let failed = 0;
  for (const chunk of chunks) {
    try {
      const vec = await embed(chunk.content);
      await pool.query(
        `INSERT INTO noah_kb (id, content, embedding, title, topic, keywords, metadata)
         VALUES ($1, $2, $3::vector, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE
         SET content = EXCLUDED.content,
             embedding = EXCLUDED.embedding,
             title = EXCLUDED.title,
             topic = EXCLUDED.topic,
             keywords = EXCLUDED.keywords,
             metadata = EXCLUDED.metadata,
             updated_at = NOW()`,
        [
          chunk.id,
          chunk.content,
          pgvector.toSql(vec),
          chunk.title,
          chunk.topic,
          chunk.keywords,
          {},
        ]
      );
      inserted++;
      process.stdout.write(".");
    } catch (e) {
      failed++;
      console.error(`\nFailed chunk ${chunk.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\nSeeded ${inserted} chunk${inserted === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}.`);
  await pool.end();
}

main().catch((e) => {
  console.error("seed-kb failed:", e);
  process.exit(1);
});
