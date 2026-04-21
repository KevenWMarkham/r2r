// Seed the 5 Acme sample contracts into the database.
// Run once after docker compose up + initial schema migration.
// Usage: pnpm seed

import fs from "node:fs/promises";
import path from "node:path";
import pgvector from "pgvector";
import { query, pool } from "../db.js";
import { extract } from "../lib/ingest.js";
import { embed } from "../lib/embeddings.js";

const SAMPLES_DIR = path.resolve(process.cwd(), "..", "samples", "acme");

async function seed() {
  const files = (await fs.readdir(SAMPLES_DIR)).filter(f => f.endsWith(".docx") || f.endsWith(".pdf"));
  console.log(`Found ${files.length} sample contracts in ${SAMPLES_DIR}`);

  for (const file of files) {
    const fullPath = path.join(SAMPLES_DIR, file);
    const bytes = await fs.readFile(fullPath);
    console.log(`  [${file}] extracting...`);
    const doc = await extract(bytes, file);

    const inserted = await query(
      `INSERT INTO contracts (filename, file_type, bytes, sha256, byte_size, source)
       VALUES ($1, $2, $3, $4, $5, 'sample_acme')
       ON CONFLICT (sha256) DO UPDATE SET filename = EXCLUDED.filename
       RETURNING id, (xmax = 0) AS inserted`,
      [file, doc.fileType, bytes, doc.sha256, doc.byteSize]
    );
    const contractId = inserted.rows[0].id;
    const isNew = inserted.rows[0].inserted;

    console.log(`  [${file}] embedding (${doc.fullText.length} chars)...`);
    const emb = await embed(doc.fullText);

    await query(
      `INSERT INTO contract_metabase (contract_id, full_text, embedding, agent_status)
       VALUES ($1, $2, $3, '{"extract": "pending"}'::jsonb)
       ON CONFLICT (contract_id) DO UPDATE
       SET full_text = EXCLUDED.full_text,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
      [contractId, doc.fullText, pgvector.toSql(emb)]
    );

    console.log(`  [${file}] ${isNew ? "inserted" : "updated"}  id=${contractId}`);
  }

  console.log("Seeding complete.");
  await pool.end();
}

seed().catch(e => {
  console.error("Seed failed:", e);
  process.exit(1);
});
