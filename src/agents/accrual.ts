import { extractAccrualInputs, type AccrualInputs } from "./accrual-inputs";
import {
  calculateAccrual,
  parseCurrency,
  parseDate,
  type AccrualCalcResult,
  type AccrualMethod,
} from "@/lib/accrual-math";
import { buildAccrualJE, type ProposedJE, type ClauseRef } from "@/lib/je-builder";
import type { ContractAttributes } from "./contract-schema";

export interface AccrualPipelineResult {
  inputs: AccrualInputs;
  calc: AccrualCalcResult;
  je: ProposedJE;
  missing: string[];
}

export interface AccrualPipelineOptions {
  contractId: string;
  counterparty: string;
  periodEnd?: Date;         // defaults to end of current month
  billedToDate?: number;    // GR/IR proxy; defaults to 0 for prototype
  method?: AccrualMethod;   // overrides expense_recognition_method
}

export class AccrualGapError extends Error {
  constructor(public missing: string[]) {
    super(`Cannot compute accrual — missing inputs: ${missing.join(", ")}`);
  }
}

function endOfMonth(d: Date): Date {
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  n.setHours(23, 59, 59, 0);
  return n;
}

function methodFromInputs(i: AccrualInputs): AccrualMethod {
  switch (i.expense_recognition_method) {
    case "straight-line":
    case "immediate":
    case "direct-association":
      return i.expense_recognition_method;
    default:
      // Fallback inference by billing frequency
      if (i.billing_frequency === "one-time") return "immediate";
      if (i.billing_frequency === "milestone") return "direct-association";
      return "straight-line";
  }
}

export async function runAccrualPipeline(
  attributes: ContractAttributes,
  fullText: string,
  opts: AccrualPipelineOptions
): Promise<AccrualPipelineResult> {
  // 1. Extract accrual inputs via LLM (strings/dates only)
  const inputs = await extractAccrualInputs(fullText, attributes);

  // 2. Parse strings to numbers/dates (TypeScript only — type-enforced seam)
  const totalFee = parseCurrency(inputs.total_fee_amount_string);
  const serviceStart = parseDate(inputs.service_start_date);
  const serviceEnd = parseDate(inputs.service_end_date);

  const missing: string[] = [...inputs.missing];
  if (totalFee === null) missing.push("total_fee_amount_string (unparseable)");
  if (serviceStart === null) missing.push("service_start_date (unparseable)");
  if (serviceEnd === null) missing.push("service_end_date (unparseable)");

  if (totalFee === null || serviceStart === null || serviceEnd === null) {
    throw new AccrualGapError(missing);
  }

  // 3. Compute accrual with deterministic TS math
  const periodEnd = opts.periodEnd ?? endOfMonth(new Date());
  const method = opts.method ?? methodFromInputs(inputs);
  const calc = calculateAccrual({
    totalFee,
    serviceStart,
    serviceEnd,
    periodEnd,
    method,
    billedToDate: opts.billedToDate ?? 0,
  });

  // 4. Build proposed JE
  const clauseRefs: ClauseRef[] = buildClauseRefs(attributes);
  const je = buildAccrualJE({
    contractId: opts.contractId,
    counterparty: opts.counterparty,
    periodEnd,
    calc,
    clauseRefs,
  });

  return { inputs, calc, je, missing };
}

function buildClauseRefs(attributes: ContractAttributes): ClauseRef[] {
  const a = attributes as unknown as Record<
    string,
    { value: unknown; source_page: number | null } | undefined
  >;
  const refs: ClauseRef[] = [];
  const linkFields = [
    "total_contract_value",
    "fee_schedule",
    "service_start_date",
    "service_end_date",
    "billing_frequency",
    "expense_recognition_method",
  ];
  for (const f of linkFields) {
    const v = a[f];
    if (v && v.source_page !== null) {
      refs.push({ field: f, page: v.source_page });
    }
  }
  return refs;
}
