// Smoke test: run the extractor prompt against one seeded contract end-to-end.
// Validates the Qwen + schema flow works before wiring up the UI.
// Usage: pnpm tsx src/scripts/smoke-extract.ts

import { Agent, setGlobalDispatcher } from "undici";
import { query, pool } from "../db.js";

// Qwen can take 60-180s on a full contract; raise Node fetch timeouts.
setGlobalDispatcher(new Agent({ headersTimeout: 600_000, bodyTimeout: 600_000 }));

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const QWEN_MODEL = process.env.QWEN_MODEL ?? "qwen2.5:7b";

const ATTRIBUTE_NAMES = [
  "counterparty", "contract_type", "effective_date", "expiration_date",
  "total_contract_value", "currency", "payment_terms", "billing_frequency",
  "fee_schedule", "service_description", "service_start_date", "service_end_date",
  "auto_renewal", "termination_notice_days", "governing_law", "indemnification_present",
  "liability_cap", "lease_component", "embedded_derivative", "expense_recognition_method",
  "performance_obligations", "pricing_variability", "minimum_commitment", "exclusivity_clause",
  "ip_ownership", "confidentiality_term", "change_order_mechanism",
];

const SYSTEM = `You are a meticulous contract analyst. Extract exactly the 27 specified attributes from a contract. For each attribute provide: value (string|number|boolean|null), confidence (0..1), source_page (int|null). Never guess - set value null and confidence 0 if unclear. Return ONLY valid JSON, no markdown.`;

async function main() {
  const filename = process.argv[2] ?? "Contract_1_Advertising_Campaign.docx";
  const { rows } = await query(
    `SELECT c.id, c.filename, m.full_text
     FROM contracts c JOIN contract_metabase m ON m.contract_id = c.id
     WHERE c.filename = $1 LIMIT 1`,
    [filename]
  );
  if (rows.length === 0) {
    console.error(`No contract named ${filename}`);
    await pool.end();
    process.exit(1);
  }
  const { id, full_text } = rows[0];
  console.log(`→ Extracting ${filename} (id=${id}, ${full_text.length} chars)`);

  const schemaHint = `{\n${ATTRIBUTE_NAMES.map(n =>
    `  "${n}": { "value": <string|number|boolean|null>, "confidence": <0..1>, "source_page": <int|null> }`
  ).join(",\n")}\n}`;

  const truncated = full_text.slice(0, 12000);
  const prompt = `Contract text:\n\n${truncated}\n\nExtract all 27 attributes.\n\nRespond with valid JSON matching:\n${schemaHint}`;

  const t0 = Date.now();
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: QWEN_MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    console.error(`Ollama error: HTTP ${res.status}`);
    await pool.end();
    process.exit(1);
  }
  const data = await res.json();
  const content = data?.message?.content ?? "";
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error(`Bad JSON: ${content.slice(0, 300)}`);
    await pool.end();
    process.exit(1);
  }

  const populated = ATTRIBUTE_NAMES.filter(n => parsed[n]?.value != null).length;
  const highConfidence = ATTRIBUTE_NAMES.filter(n => (parsed[n]?.confidence ?? 0) >= 0.8).length;
  const avgConfidence = ATTRIBUTE_NAMES.reduce((s, n) => s + (parsed[n]?.confidence ?? 0), 0) / ATTRIBUTE_NAMES.length;

  console.log(`\n✓ Extracted in ${ms}ms`);
  console.log(`  Populated (non-null): ${populated} / 27`);
  console.log(`  High-confidence (≥0.8): ${highConfidence} / 27`);
  console.log(`  Avg confidence: ${avgConfidence.toFixed(2)}`);

  console.log(`\n  Top fields:`);
  ["counterparty", "contract_type", "effective_date", "total_contract_value", "currency", "billing_frequency", "governing_law"].forEach(n => {
    const f = parsed[n];
    if (f) console.log(`    ${n.padEnd(24)} ${String(f.value ?? "—").padEnd(45)} conf=${(f.confidence ?? 0).toFixed(2)}`);
  });

  await pool.end();
}

main().catch(e => {
  console.error("Failed:", e);
  process.exit(1);
});
