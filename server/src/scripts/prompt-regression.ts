// Prompt regression harness. Runs the extractor against all Acme sample contracts
// and compares key fields against golden expectations. Catches prompt drift when
// Qwen model or system prompts change.
//
// Usage from server/:  pnpm tsx src/scripts/prompt-regression.ts
// Exit code: 0 = all passed, 1 = any mismatch.

import fs from "node:fs";
import path from "node:path";
import { Agent, setGlobalDispatcher } from "undici";
import { query, pool } from "../db.js";

setGlobalDispatcher(new Agent({ headersTimeout: 600_000, bodyTimeout: 600_000 }));

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const QWEN_MODEL = process.env.QWEN_MODEL ?? "qwen2.5:7b";

const ATTR_NAMES = [
  "counterparty", "contract_type", "effective_date", "expiration_date",
  "total_contract_value", "currency", "payment_terms", "billing_frequency",
  "fee_schedule", "service_description", "service_start_date", "service_end_date",
  "auto_renewal", "termination_notice_days", "governing_law", "indemnification_present",
  "liability_cap", "lease_component", "embedded_derivative", "expense_recognition_method",
  "performance_obligations", "pricing_variability", "minimum_commitment", "exclusivity_clause",
  "ip_ownership", "confidentiality_term", "change_order_mechanism",
];

const GOLDEN_DIR = path.resolve(process.cwd(), "tests", "golden");

interface GoldenExpectation {
  filename: string;
  /** Subset of attributes the extractor MUST populate with matching value (case-insensitive contains). */
  must_contain: Record<string, string | number | boolean>;
  /** Attributes that must be flagged (true) — e.g. embedded_derivative for AWS. */
  must_flag_true?: string[];
  /** Minimum overall avg confidence. */
  min_avg_confidence?: number;
  /** Minimum fields with confidence >= 0.8. */
  min_high_confidence_count?: number;
  /** Output must NOT contain these numeric tokens (hallucination check). */
  forbidden_numbers?: string[];
}

async function extractViaQwen(fullText: string): Promise<Record<string, { value: unknown; confidence: number }> | null> {
  const schemaHint = `{\n${ATTR_NAMES.map(n =>
    `  "${n}": { "value": any, "confidence": number, "source_page": number|null }`
  ).join(",\n")}\n}`;
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: QWEN_MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
      messages: [
        {
          role: "system",
          content:
            "You are a meticulous contract analyst. Extract the 27 specified attributes with {value, confidence, source_page}. Never guess. Return ONLY JSON.",
        },
        {
          role: "user",
          content: `Contract:\n${fullText.slice(0, 12000)}\n\nReturn JSON matching:\n${schemaHint}`,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  try {
    return JSON.parse(data?.message?.content ?? "");
  } catch {
    return null;
  }
}

async function run() {
  const goldens = fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".expected.json"));
  if (goldens.length === 0) {
    console.log(`No golden fixtures in ${GOLDEN_DIR}. Create .expected.json files per sample.`);
    await pool.end();
    return 0;
  }

  let failed = 0;

  for (const golden of goldens) {
    const expected: GoldenExpectation = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, golden), "utf8"));
    console.log(`\n── ${expected.filename} ──`);

    const { rows } = await query(
      `SELECT m.full_text FROM contracts c JOIN contract_metabase m ON m.contract_id = c.id WHERE c.filename = $1 LIMIT 1`,
      [expected.filename]
    );
    if (rows.length === 0) {
      console.log(`  ✗ Contract not in DB — run \`pnpm seed\` first`);
      failed++;
      continue;
    }

    const fullText: string = rows[0].full_text;
    const attrs = await extractViaQwen(fullText);
    if (!attrs) {
      console.log(`  ✗ Extraction returned null (Ollama error or bad JSON)`);
      failed++;
      continue;
    }

    let localFailures = 0;

    // must_contain checks (case-insensitive substring on string values; exact on numbers/bools)
    for (const [field, expectedVal] of Object.entries(expected.must_contain)) {
      const got = attrs[field]?.value;
      const ok =
        typeof expectedVal === "string" && typeof got === "string"
          ? got.toLowerCase().includes(expectedVal.toLowerCase())
          : got === expectedVal;
      console.log(`  ${ok ? "✓" : "✗"} ${field}: expected ~${JSON.stringify(expectedVal)}, got ${JSON.stringify(got)}`);
      if (!ok) localFailures++;
    }

    // must_flag_true
    for (const field of expected.must_flag_true ?? []) {
      const ok = attrs[field]?.value === true;
      console.log(`  ${ok ? "✓" : "✗"} ${field} flagged true: got ${JSON.stringify(attrs[field]?.value)}`);
      if (!ok) localFailures++;
    }

    // avg confidence
    const confidences = ATTR_NAMES.map((n) => attrs[n]?.confidence ?? 0);
    const avgConf = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const highConf = confidences.filter((c) => c >= 0.8).length;

    if (expected.min_avg_confidence != null) {
      const ok = avgConf >= expected.min_avg_confidence;
      console.log(`  ${ok ? "✓" : "✗"} avg confidence ${avgConf.toFixed(2)} (min ${expected.min_avg_confidence})`);
      if (!ok) localFailures++;
    }
    if (expected.min_high_confidence_count != null) {
      const ok = highConf >= expected.min_high_confidence_count;
      console.log(`  ${ok ? "✓" : "✗"} high-confidence count ${highConf} (min ${expected.min_high_confidence_count})`);
      if (!ok) localFailures++;
    }

    // forbidden_numbers — hallucination check
    const rendered = JSON.stringify(attrs);
    for (const forbidden of expected.forbidden_numbers ?? []) {
      const ok = !rendered.includes(forbidden);
      console.log(`  ${ok ? "✓" : "✗"} output does not contain forbidden number "${forbidden}"`);
      if (!ok) localFailures++;
    }

    if (localFailures === 0) {
      console.log(`  PASSED`);
    } else {
      console.log(`  FAILED (${localFailures} check${localFailures === 1 ? "" : "s"})`);
      failed++;
    }
  }

  await pool.end();
  console.log(`\n${"=".repeat(48)}`);
  console.log(failed === 0 ? `ALL ${goldens.length} PASSED` : `${failed} FAILED / ${goldens.length} TOTAL`);
  return failed === 0 ? 0 : 1;
}

run().then((code) => process.exit(code)).catch((e) => {
  console.error("Harness failed:", e);
  process.exit(1);
});
