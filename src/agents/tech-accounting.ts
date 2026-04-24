import { chatJSON, OllamaError } from "./ollama-client";
import type { ContractAttributes } from "./contract-schema";

export type LeaseStandard = "ASC 840" | "ASC 842";
export type ExpenseMethod = "straight-line" | "immediate" | "direct-association" | "unknown";

export interface TechAccountingFlags {
  lease: {
    flagged: boolean;
    standard: LeaseStandard | null;
    reasoning: string;
  };
  derivative: {
    flagged: boolean;
    standard: "ASC 815" | null;
    reasoning: string;
  };
  expense_method: ExpenseMethod;
  requires_senior_review: boolean;
}

const SYSTEM = `You are a technical accounting specialist. Analyze a contract for three specific determinations:

1. Lease component (ASC 840 / ASC 842): Does this contract contain a lease? A lease is the right to control an identified asset (equipment, space, vehicle, etc.) for a period in exchange for consideration. For contracts executed under US GAAP after 2019, use ASC 842; otherwise ASC 840.

2. Embedded derivative (ASC 815): Does the contract contain a feature indexed to a financial variable (interest rate, commodity price, FX, credit rating, CPI/inflation)? If yes, it may require bifurcation under ASC 815.

3. Expense recognition method: How should expense be recognized?
   - "straight-line" — equal benefit over multiple periods (most services, leases)
   - "immediate" — benefit received at signing or one-time event
   - "direct-association" — tied to specific deliverables or milestones
   - "unknown" — insufficient information

4. Requires senior review — true when ANY of: lease flagged, derivative flagged, or expense_method is "unknown".

Be conservative. If unsure, set flagged=false and add a note in reasoning. Return ONLY valid JSON.`;

const SCHEMA_HINT = `{
  "lease": { "flagged": <bool>, "standard": "ASC 840"|"ASC 842"|null, "reasoning": "<string>" },
  "derivative": { "flagged": <bool>, "standard": "ASC 815"|null, "reasoning": "<string>" },
  "expense_method": "straight-line"|"immediate"|"direct-association"|"unknown",
  "requires_senior_review": <bool>
}`;

export async function flagTechnicalAccounting(
  fullText: string,
  attributes: ContractAttributes
): Promise<TechAccountingFlags> {
  const truncated = fullText.length > 10000 ? fullText.slice(0, 10000) : fullText;

  // Nudge the LLM with existing structured hints
  const hints: string[] = [];
  const a = attributes as unknown as Record<string, { value: unknown } | undefined>;
  if (a.lease_component?.value) hints.push(`lease_component attribute: ${a.lease_component.value}`);
  if (a.embedded_derivative?.value) hints.push(`embedded_derivative attribute: ${a.embedded_derivative.value}`);
  if (a.expense_recognition_method?.value)
    hints.push(`expense_recognition_method attribute: ${a.expense_recognition_method.value}`);
  if (a.effective_date?.value) hints.push(`effective_date: ${a.effective_date.value}`);

  const prompt = `Contract:\n\n${truncated}\n\n${hints.length ? `Structured hints:\n- ${hints.join("\n- ")}\n\n` : ""}Analyze for ASC 840/842 lease, ASC 815 derivative, and expense recognition method.`;

  try {
    const r = await chatJSON<TechAccountingFlags>({
      system: SYSTEM,
      prompt,
      schemaHint: SCHEMA_HINT,
      temperature: 0.1,
    });
    return normalize(r);
  } catch (e) {
    if (e instanceof OllamaError) {
      return {
        lease: { flagged: false, standard: null, reasoning: `Classifier unavailable: ${e.message}` },
        derivative: { flagged: false, standard: null, reasoning: `Classifier unavailable: ${e.message}` },
        expense_method: "unknown",
        requires_senior_review: true,
      };
    }
    throw e;
  }
}

function normalize(r: Partial<TechAccountingFlags>): TechAccountingFlags {
  const lease = r.lease ?? { flagged: false, standard: null, reasoning: "" };
  const derivative = r.derivative ?? { flagged: false, standard: null, reasoning: "" };
  const expense_method: ExpenseMethod =
    ["straight-line", "immediate", "direct-association", "unknown"].includes(r.expense_method as string)
      ? (r.expense_method as ExpenseMethod)
      : "unknown";
  // Senior review is DETERMINED by the actual flags, not the LLM's self-report.
  // The LLM sometimes flags senior review conservatively even when nothing is
  // actually flagged — here we compute it deterministically so the banner is
  // always consistent with the flag rows shown below it.
  const requires_senior_review = !!lease.flagged || !!derivative.flagged || expense_method === "unknown";
  return {
    lease: {
      flagged: !!lease.flagged,
      standard: lease.standard === "ASC 840" || lease.standard === "ASC 842" ? lease.standard : null,
      reasoning: String(lease.reasoning ?? ""),
    },
    derivative: {
      flagged: !!derivative.flagged,
      standard: derivative.standard === "ASC 815" ? "ASC 815" : null,
      reasoning: String(derivative.reasoning ?? ""),
    },
    expense_method,
    requires_senior_review,
  };
}
