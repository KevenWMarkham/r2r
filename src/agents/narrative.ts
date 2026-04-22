import { chatJSON, OllamaError } from "./ollama-client";
import type { PnLLine } from "@/data/seed-pnl";

// ── UC-18: Variance commentary ───────────────────────────────────────────────
export interface VarianceCommentary {
  commentary: string;      // 2-3 sentences of prose
  key_drivers: string[];   // compact bullet summary of drivers
  risk_flags: string[];    // disclosure / audit risks
  confidence: number;      // 0..1
}

const VARIANCE_SYSTEM = `You are a senior financial analyst writing for a Fortune 500 controller.

Produce variance commentary that is:
- PRECISE: cite the actual dollar amount and percent change from the data provided
- GROUNDED: only use numbers present in the input. NEVER invent figures.
- CONCISE: exactly 2-3 sentences, CFO-memo tone, neutral
- ACTIONABLE: call out any item that could require disclosure (one-time, material FX, method change)

Return ONLY valid JSON. No prose, no markdown, no code fences.`;

const VARIANCE_SCHEMA_HINT = `{
  "commentary": "<2-3 sentence prose>",
  "key_drivers": [<string>, ...],
  "risk_flags": [<string>, ...],
  "confidence": <0..1>
}`;

function formatDollars(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export async function generateVarianceCommentary(line: PnLLine): Promise<VarianceCommentary> {
  const prompt = `P&L line item: ${line.lineItem} (${line.category})
Current period: ${formatDollars(line.currentPeriod)} (${line.currentPeriod.toLocaleString()})
Prior period: ${formatDollars(line.priorPeriod)} (${line.priorPeriod.toLocaleString()})
Variance: ${formatDollars(line.variance)} (${line.variancePct >= 0 ? "+" : ""}${line.variancePct.toFixed(1)}%)
Known drivers: ${line.driver}
Entity split (current period):
  NA: ${formatDollars(line.entitySplit.NA)}
  EMEA: ${formatDollars(line.entitySplit.EMEA)}
  GC: ${formatDollars(line.entitySplit.GC)}
  APLA: ${formatDollars(line.entitySplit.APLA)}

Generate variance commentary using ONLY these numbers.`;

  try {
    const r = await chatJSON<VarianceCommentary>({
      system: VARIANCE_SYSTEM,
      prompt,
      schemaHint: VARIANCE_SCHEMA_HINT,
      temperature: 0.2,
    });
    return normalizeVariance(r);
  } catch (e) {
    if (e instanceof OllamaError) {
      return {
        commentary: `Commentary unavailable (${e.message}). Line: ${line.lineItem} — ${formatDollars(line.variance)} (${line.variancePct.toFixed(1)}%) vs prior.`,
        key_drivers: [line.driver],
        risk_flags: ["LLM call failed; manual commentary required"],
        confidence: 0,
      };
    }
    throw e;
  }
}

function normalizeVariance(r: Partial<VarianceCommentary>): VarianceCommentary {
  return {
    commentary: String(r.commentary ?? "").trim(),
    key_drivers: Array.isArray(r.key_drivers) ? r.key_drivers.map(String) : [],
    risk_flags: Array.isArray(r.risk_flags) ? r.risk_flags.map(String) : [],
    confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
  };
}

// ── UC-20: Executive close narrative ─────────────────────────────────────────
export interface ExecutiveSummary {
  headline: string;                 // 1-sentence hook
  key_highlights: string[];         // 3-5 bullets
  risks: string[];                  // 1-3 bullets
  recommendation: string;           // 1 sentence
}

export interface ExecInputs {
  closeDays: number;                // e.g. 5.2
  closeTarget: number;              // e.g. 8
  autoCertRate: number;             // 0..1
  topVariances: PnLLine[];          // top 3 by abs dollar
  risks: string[];                  // known risk callouts
  period: string;                   // e.g. "Q2 FY26"
}

const EXEC_SYSTEM = `You are a CFO's chief of staff drafting a board-ready close summary. Voice: concise, quantified, neutral. 1 headline sentence, 3-5 bullet highlights, 1-3 risk bullets, 1 recommendation sentence.

Rules:
- Use ONLY numbers provided. NEVER invent figures.
- Quote actual line items by name.
- Recommendation should be a clear go/no-go statement appropriate for a controller audience.
- Return ONLY valid JSON.`;

const EXEC_SCHEMA_HINT = `{
  "headline": "<1 sentence>",
  "key_highlights": [<string>, ...],
  "risks": [<string>, ...],
  "recommendation": "<1 sentence>"
}`;

export async function generateExecutiveSummary(inputs: ExecInputs): Promise<ExecutiveSummary> {
  const topVariancesBlock = inputs.topVariances
    .map(
      (l) =>
        `  - ${l.lineItem}: ${formatDollars(l.variance)} (${l.variancePct >= 0 ? "+" : ""}${l.variancePct.toFixed(1)}%) — ${l.driver}`
    )
    .join("\n");

  const prompt = `Close summary inputs for ${inputs.period}:

Operational metrics:
- Close cycle: ${inputs.closeDays.toFixed(1)} days (vs target ${inputs.closeTarget} days)
- Auto-certification rate: ${(inputs.autoCertRate * 100).toFixed(0)}%

Top 3 P&L variances by dollar impact:
${topVariancesBlock}

Known risks:
${inputs.risks.length ? inputs.risks.map((r) => `- ${r}`).join("\n") : "- None flagged"}

Produce an executive close summary.`;

  try {
    const r = await chatJSON<ExecutiveSummary>({
      system: EXEC_SYSTEM,
      prompt,
      schemaHint: EXEC_SCHEMA_HINT,
      temperature: 0.2,
    });
    return normalizeExec(r);
  } catch (e) {
    if (e instanceof OllamaError) {
      return {
        headline: `Close summary unavailable: ${e.message}`,
        key_highlights: [],
        risks: ["LLM call failed; manual drafting required"],
        recommendation: "Pending — manual narrative required.",
      };
    }
    throw e;
  }
}

function normalizeExec(r: Partial<ExecutiveSummary>): ExecutiveSummary {
  return {
    headline: String(r.headline ?? "").trim(),
    key_highlights: Array.isArray(r.key_highlights) ? r.key_highlights.map(String) : [],
    risks: Array.isArray(r.risks) ? r.risks.map(String) : [],
    recommendation: String(r.recommendation ?? "").trim(),
  };
}
