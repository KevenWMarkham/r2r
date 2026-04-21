import { Router } from "express";
import multer from "multer";
import pgvector from "pgvector";
import { query } from "../db.js";
import { extract, IngestError } from "../lib/ingest.js";
import { embed, EmbeddingError } from "../lib/embeddings.js";

export const contractsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ── GET /api/contracts — list all contracts with summary metadata ─────────────
contractsRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM v_contract_summary`);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET /api/contracts/:id — single contract with full metabase row ───────────
contractsRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.filename, c.file_type, c.byte_size, c.source, c.uploaded_at,
              m.attributes, m.risk_score, m.risk_category, m.risk_reasons,
              m.tech_acct_flags, m.proposed_je, m.narrative, m.agent_status,
              m.full_text, m.updated_at
       FROM contracts c
       LEFT JOIN contract_metabase m ON m.contract_id = c.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── GET /api/contracts/:id/blob — stream the original file bytes ──────────────
contractsRouter.get("/:id/blob", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT filename, file_type, bytes FROM contracts WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const { filename, file_type, bytes } = rows[0];
    res.setHeader("Content-Type", file_type === "pdf" ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(bytes);
  } catch (e) { next(e); }
});

// ── POST /api/contracts — upload + ingest + embed ─────────────────────────────
contractsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided (field name: 'file')" });

    const { buffer, originalname } = req.file;
    const source = (req.body.source as string) ?? "upload";

    // 1. Extract text + hash
    const doc = await extract(buffer, originalname);

    // 2. Insert blob (upsert on sha256 — dedup)
    const contractResult = await query(
      `INSERT INTO contracts (filename, file_type, bytes, sha256, byte_size, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sha256) DO UPDATE SET filename = EXCLUDED.filename
       RETURNING id, (xmax = 0) AS inserted`,
      [originalname, doc.fileType, buffer, doc.sha256, doc.byteSize, source]
    );
    const contractId = contractResult.rows[0].id;
    const isNew = contractResult.rows[0].inserted;

    // 3. Embed full text
    const embedding = await embed(doc.fullText);

    // 4. Upsert metabase row
    await query(
      `INSERT INTO contract_metabase (contract_id, full_text, embedding, agent_status)
       VALUES ($1, $2, $3, '{"extract": "pending"}'::jsonb)
       ON CONFLICT (contract_id) DO UPDATE
       SET full_text = EXCLUDED.full_text,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
      [contractId, doc.fullText, pgvector.toSql(embedding)]
    );

    // 5. Audit
    await query(
      `INSERT INTO audit_events (event_type, contract_id, agent, payload)
       VALUES ('upload', $1, 'ingest', $2::jsonb)`,
      [contractId, JSON.stringify({ filename: originalname, byte_size: doc.byteSize, is_new: isNew })]
    );

    res.status(201).json({
      id: contractId,
      filename: originalname,
      file_type: doc.fileType,
      sha256: doc.sha256,
      byte_size: doc.byteSize,
      is_new: isNew,
      embedding_dim: embedding.length,
    });
  } catch (e) {
    if (e instanceof IngestError) return res.status(400).json({ error: e.message });
    if (e instanceof EmbeddingError) return res.status(502).json({ error: e.message, hint: "Ensure Ollama is running and the embedding model is pulled: ollama pull nomic-embed-text" });
    next(e);
  }
});

// ── DELETE /api/contracts/:id ─────────────────────────────────────────────────
contractsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await query(`DELETE FROM contracts WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (e) { next(e); }
});
