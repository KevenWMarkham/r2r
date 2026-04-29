import { Agent, setGlobalDispatcher } from "undici";

// Node's default undici fetch has a 30s headersTimeout; Qwen extraction can take
// 60-180s. Raise global timeouts so server-side LLM calls don't die prematurely.
setGlobalDispatcher(new Agent({ headersTimeout: 600_000, bodyTimeout: 600_000 }));

import express from "express";
import cors from "cors";
import { contractsRouter } from "./routes/contracts.js";
import { searchRouter } from "./routes/search.js";
import { auditRouter } from "./routes/audit.js";
import { metabaseRouter } from "./routes/metabase.js";
import { jeRouter } from "./routes/je.js";
import { kbRouter } from "./routes/kb.js";
import { pool } from "./db.js";
import { applyMigrations } from "./lib/migrations.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:4173"] }));
app.use(express.json({ limit: "25mb" }));

app.get("/health", async (_req, res) => {
  try {
    const r = await pool.query("SELECT 1 AS ok, NOW() AS ts, version() AS version");
    res.json({ ok: true, db: "connected", ts: r.rows[0].ts, pg_version: r.rows[0].version });
  } catch (e) {
    res.status(503).json({ ok: false, db: "unreachable", error: String(e) });
  }
});

app.use("/api/contracts", contractsRouter);
app.use("/api/metabase", metabaseRouter);
app.use("/api/search", searchRouter);
app.use("/api/audit", auditRouter);
app.use("/api/je", jeRouter);
app.use("/api/kb", kbRouter);

// 404 + error handlers
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

async function start() {
  try {
    await applyMigrations();
  } catch (e) {
    console.warn(`Migrations skipped (DB may be unavailable): ${e instanceof Error ? e.message : String(e)}`);
  }
  app.listen(PORT, () => {
    console.log(`NOAH prototype server listening on http://localhost:${PORT}`);
  });
}

void start();
