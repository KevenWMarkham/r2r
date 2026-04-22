import { chatJSON, OllamaError } from "./ollama-client";
import type { ContractAttributes } from "./contract-schema";

// CRITICAL: AccrualInputs has NO numeric fields. The LLM returns strings/dates only.
// Numbers are parsed by TypeScript in accrual.ts orchestrator. Enforced by type.
export type BillingFrequency =
  | "monthly"
  | "quarterly"
  | "annual"
  | "semi-annual"
  | "milestone"
  | "one-time"
  | "other";

export interface AccrualInputs {
  fee_schedule_description: string;
  total_fee_amount_string: string;   // e.g. "$8,400,000" — parsed in accrual.ts
  currency: string;
  service_start_date: string;        // ISO-preferred but accept natural text
  service_end_date: string;
  billing_frequency: BillingFrequency;
  expense_recognition_method: "straight-line" | "immediate" | "direct-association" | "unknown";
  missing: string[];                 // which attributes couldn't be confidently extracted
}

const SYSTEM = `You are an accountant extracting accrual-relevant terms from a contract. Return strings and dates ONLY — never compute or return a numeric total. The downstream system does all math.

For each field, extract what the contract states verbatim:
- fee_schedule_description: Quote the fee schedule clause (1-3 sentences max)
- total_fee_amount_string: The headline total or annual amount as written (e.g. "$8,400,000", "$1.2M annually")
- currency: ISO currency code (USD, EUR, GBP, CAD, etc.)
- service_start_date: ISO date (YYYY-MM-DD) or natural text if ambiguous
- service_end_date: ISO date (YYYY-MM-DD) or natural text if ambiguous
- billing_frequency: one of monthly|quarterly|annual|semi-annual|milestone|one-time|other
- expense_recognition_method: straight-line|immediate|direct-association|unknown
- missing: array of field names you could NOT extract confidently

Return ONLY valid JSON.`;

const SCHEMA_HINT = `{
  "fee_schedule_description": "<string>",
  "total_fee_amount_string": "<string>",
  "currency": "<ISO currency code>",
  "service_start_date": "<YYYY-MM-DD or natural text>",
  "service_end_date": "<YYYY-MM-DD or natural text>",
  "billing_frequency": "monthly"|"quarterly"|"annual"|"semi-annual"|"milestone"|"one-time"|"other",
  "expense_recognition_method": "straight-line"|"immediate"|"direct-association"|"unknown",
  "missing": [<string>, ...]
}`;

export async function extractAccrualInputs(
  fullText: string,
  attributes: ContractAttributes
): Promise<AccrualInputs> {
  const truncated = fullText.length > 10000 ? fullText.slice(0, 10000) : fullText;
  const a = attributes as unknown as Record<string, { value: unknown } | undefined>;
  const hints = [
    a.total_contract_value?.value && `total_contract_value: ${a.total_contract_value.value}`,
    a.currency?.value && `currency: ${a.currency.value}`,
    a.service_start_date?.value && `service_start_date: ${a.service_start_date.value}`,
    a.service_end_date?.value && `service_end_date: ${a.service_end_date.value}`,
    a.billing_frequency?.value && `billing_frequency: ${a.billing_frequency.value}`,
    a.fee_schedule?.value && `fee_schedule: ${a.fee_schedule.value}`,
    a.expense_recognition_method?.value && `expense_recognition_method: ${a.expense_recognition_method.value}`,
  ].filter(Boolean);

  const prompt = `Contract:\n\n${truncated}\n\n${hints.length ? `Structured hints from prior extraction:\n- ${hints.join("\n- ")}\n\n` : ""}Extract accrual-relevant fields as strings/dates.`;

  try {
    const r = await chatJSON<AccrualInputs>({
      system: SYSTEM,
      prompt,
      schemaHint: SCHEMA_HINT,
      temperature: 0.1,
    });
    return normalize(r);
  } catch (e) {
    if (e instanceof OllamaError) {
      return {
        fee_schedule_description: "",
        total_fee_amount_string: "",
        currency: "",
        service_start_date: "",
        service_end_date: "",
        billing_frequency: "other",
        expense_recognition_method: "unknown",
        missing: ["all — Ollama call failed"],
      };
    }
    throw e;
  }
}

function normalize(r: Partial<AccrualInputs>): AccrualInputs {
  const validFreqs: BillingFrequency[] = [
    "monthly", "quarterly", "annual", "semi-annual", "milestone", "one-time", "other",
  ];
  const validMethods = ["straight-line", "immediate", "direct-association", "unknown"] as const;
  return {
    fee_schedule_description: String(r.fee_schedule_description ?? ""),
    total_fee_amount_string: String(r.total_fee_amount_string ?? ""),
    currency: String(r.currency ?? ""),
    service_start_date: String(r.service_start_date ?? ""),
    service_end_date: String(r.service_end_date ?? ""),
    billing_frequency: validFreqs.includes(r.billing_frequency as BillingFrequency)
      ? (r.billing_frequency as BillingFrequency)
      : "other",
    expense_recognition_method: validMethods.includes(r.expense_recognition_method as (typeof validMethods)[number])
      ? (r.expense_recognition_method as AccrualInputs["expense_recognition_method"])
      : "unknown",
    missing: Array.isArray(r.missing) ? r.missing.map(String) : [],
  };
}
