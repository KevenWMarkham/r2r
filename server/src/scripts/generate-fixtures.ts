// Regenerate fixtures/metabase.json from the current database + live Qwen runs.
// Prereqs:
//   - docker compose up -d postgres (healthy)
//   - `pnpm seed` has ingested all 5 Acme contracts
//   - Ollama running with qwen2.5:7b + nomic-embed-text
// Usage from server/:  pnpm tsx src/scripts/generate-fixtures.ts
//
// Runtime is ~25-30 min on CPU-only Qwen. For the prototype demo, the
// committed fixtures/metabase.json and fixtures/narratives.json contain
// synthetic-but-plausible pre-populated data so Pages deploys without
// requiring this script to run first.

import fs from "node:fs";
import path from "node:path";
import { Agent, setGlobalDispatcher } from "undici";
import { query, pool } from "../db.js";

setGlobalDispatcher(new Agent({ headersTimeout: 900_000, bodyTimeout: 900_000 }));

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const QWEN_MODEL = process.env.QWEN_MODEL ?? "qwen2.5:7b";
const OUT_METABASE = path.resolve(process.cwd(), "..", "fixtures", "metabase.json");
const OUT_NARRATIVES = path.resolve(process.cwd(), "..", "fixtures", "narratives.json");

const ATTR_NAMES = [
  "counterparty", "contract_type", "effective_date", "expiration_date",
  "total_contract_value", "currency", "payment_terms", "billing_frequency",
  "fee_schedule", "service_description", "service_start_date", "service_end_date",
  "auto_renewal", "termination_notice_days", "governing_law", "indemnification_present",
  "liability_cap", "lease_component", "embedded_derivative", "expense_recognition_method",
  "performance_obligations", "pricing_variability", "minimum_commitment", "exclusivity_clause",
  "ip_ownership", "confidentiality_term", "change_order_mechanism",
];

const EXTRACT_SYS = `You are a meticulous contract analyst. Extract the 27 specified attributes. For each: {value, confidence (0..1), source_page (int|null)}. Never guess. Return ONLY valid JSON.`;

async function chatJSON<T>(system: string, prompt: string, schemaHint: string): Promise<T | null> {
  const body = {
    model: QWEN_MODEL,
    stream: false,
    format: "json",
    options: { temperature: 0.1 },
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${prompt}\n\nReturn JSON matching:\n${schemaHint}` },
    ],
  };
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`  Ollama HTTP ${res.status}`); return null; }
  const data = await res.json();
  try { return JSON.parse(data?.message?.content ?? "") as T; }
  catch { console.error("  Bad JSON from Qwen; skipping"); return null; }
}

async function generateContractFixtures() {
  console.log("==> Generating contract fixtures...");
  const { rows } = await query(
    `SELECT c.id, c.filename, c.file_type, c.byte_size, c.source,
            c.uploaded_at, m.full_text, m.updated_at
     FROM contracts c JOIN contract_metabase m ON m.contract_id = c.id
     WHERE c.source = 'sample_acme'
     ORDER BY c.filename`
  );

  const contracts: unknown[] = [];
  for (const row of rows) {
    console.log(`  [${row.filename}] extracting attributes…`);
    const attrSchema = `{\n${ATTR_NAMES.map(n =>
      `  "${n}": { "value": any, "confidence": number, "source_page": number|null }`
    ).join(",\n")}\n}`;
    const attrs = await chatJSON<Record<string, unknown>>(EXTRACT_SYS,
      `Contract text:\n\n${row.full_text.slice(0, 12000)}\n\nExtract all 27 attributes.`,
      attrSchema
    );

    console.log(`  [${row.filename}] scoring risk (LLM signal)…`);
    const riskLLM = await chatJSON<{ risk_score: number; reasons: string[] }>(
      "You are a contract risk analyst. Return JSON only.",
      `Contract:\n${row.full_text.slice(0, 8000)}\n\nGive a 0-40 qualitative risk score.`,
      `{ "risk_score": number, "reasons": [string, ...] }`
    );

    console.log(`  [${row.filename}] tech-accounting…`);
    const tech = await chatJSON<Record<string, unknown>>(
      "You are a technical accountant. Classify ASC 842/815 and expense method. Return JSON only.",
      `Contract:\n${row.full_text.slice(0, 8000)}`,
      `{ "lease": {"flagged": bool, "standard": "ASC 840"|"ASC 842"|null, "reasoning": string},
         "derivative": {"flagged": bool, "standard": "ASC 815"|null, "reasoning": string},
         "expense_method": "straight-line"|"immediate"|"direct-association"|"unknown",
         "requires_senior_review": bool }`
    );

    console.log(`  [${row.filename}] accrual inputs…`);
    const accrualIn = await chatJSON<Record<string, unknown>>(
      "Extract accrual-relevant fields as strings/dates only. Return JSON only.",
      `Contract:\n${row.full_text.slice(0, 8000)}`,
      `{ "fee_schedule_description": string, "total_fee_amount_string": string, "currency": string,
         "service_start_date": string, "service_end_date": string,
         "billing_frequency": "monthly"|"quarterly"|"annual"|"semi-annual"|"milestone"|"one-time"|"other",
         "expense_recognition_method": "straight-line"|"immediate"|"direct-association"|"unknown",
         "missing": [string, ...] }`
    );

    contracts.push({
      id: `acme-${row.filename.split("_")[1]}`.toLowerCase(),
      filename: row.filename,
      file_type: row.file_type,
      byte_size: row.byte_size,
      source: row.source,
      uploaded_at: row.uploaded_at,
      updated_at: row.updated_at,
      attributes: attrs,
      risk_reasons: riskLLM?.reasons ?? [],
      tech_acct_flags: tech,
      accrual_inputs_raw: accrualIn,
      // Downstream fields (risk_score, proposed_je) require TS parse + math;
      // re-run in the browser or extend this script. Synthetic fixtures ship
      // pre-populated for demo reliability.
    });
  }

  fs.writeFileSync(OUT_METABASE + ".generated", JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: "live-qwen",
    contracts,
  }, null, 2));
  console.log(`\n✓ Wrote ${OUT_METABASE}.generated (${contracts.length} contracts)`);
  console.log(`  Review, then rename to metabase.json to commit.`);
}

async function main() {
  await generateContractFixtures();
  await pool.end();
}

main().catch(e => {
  console.error("Fixture generation failed:", e);
  process.exit(1);
});
