import { chatJSON, OllamaError } from "./ollama-client";
import type { ContractAttributes } from "./contract-schema";

export type RiskCategory = "High" | "Medium" | "Low";

export interface RiskResult {
  score: number; // 0..100
  category: RiskCategory;
  reasons: string[];
}

export interface RiskInputs {
  tcv: number | null;
  autoRenewal: boolean | null;
  liabilityCap: boolean | null;
  leaseComponent: boolean | null;
  embeddedDerivative: boolean | null;
}

// ── Parse structured attributes into risk inputs ─────────────────────────────
export function extractRiskInputs(attrs: ContractAttributes): RiskInputs {
  const raw = attrs as unknown as Record<string, { value: unknown } | undefined>;

  const tcvRaw = raw.total_contract_value?.value;
  const tcv = typeof tcvRaw === "number" ? tcvRaw : typeof tcvRaw === "string" ? parseMoney(tcvRaw) : null;

  const coerceBool = (v: unknown): boolean | null => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const lower = v.toLowerCase().trim();
      if (["yes", "true", "y", "present"].includes(lower)) return true;
      if (["no", "false", "n", "none", "absent"].includes(lower)) return false;
    }
    if (v === null) return false;
    return null;
  };

  return {
    tcv,
    autoRenewal: coerceBool(raw.auto_renewal?.value),
    liabilityCap: coerceBool(raw.liability_cap?.value),
    leaseComponent: coerceBool(raw.lease_component?.value),
    embeddedDerivative: coerceBool(raw.embedded_derivative?.value),
  };
}

function parseMoney(s: string): number | null {
  // "$4,200,000.00" | "USD 1,500" | "$4.2M" | "1200000"
  const cleaned = s.replace(/[,$\sUSD]/gi, "").trim();
  const mMatch = cleaned.match(/^([\d.]+)\s*[mM]$/);
  if (mMatch) return parseFloat(mMatch[1]) * 1_000_000;
  const bMatch = cleaned.match(/^([\d.]+)\s*[bB]$/);
  if (bMatch) return parseFloat(bMatch[1]) * 1_000_000_000;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// ── Rules-based scoring (0..60) ──────────────────────────────────────────────
export function scoreRules(i: RiskInputs): { points: number; reasons: string[] } {
  let points = 0;
  const reasons: string[] = [];

  if (i.tcv !== null) {
    if (i.tcv > 25_000_000) {
      points += 25;
      reasons.push(`TCV > $25M ($${(i.tcv / 1_000_000).toFixed(1)}M)`);
    } else if (i.tcv > 5_000_000) {
      points += 15;
      reasons.push(`TCV > $5M ($${(i.tcv / 1_000_000).toFixed(1)}M)`);
    } else if (i.tcv > 1_000_000) {
      points += 5;
      reasons.push(`TCV > $1M ($${(i.tcv / 1_000_000).toFixed(1)}M)`);
    }
  }
  if (i.autoRenewal === true) {
    points += 10;
    reasons.push("Auto-renewal provision");
  }
  if (i.liabilityCap === false) {
    points += 15;
    reasons.push("No liability cap");
  }
  if (i.leaseComponent === true) {
    points += 10;
    reasons.push("Lease component present (ASC 842 review required)");
  }
  if (i.embeddedDerivative === true) {
    points += 10;
    reasons.push("Embedded derivative indicated (ASC 815 review required)");
  }
  return { points: Math.min(60, points), reasons };
}

// ── LLM qualitative scoring (0..40) ──────────────────────────────────────────
interface LLMSignal {
  risk_score: number; // 0..40
  reasons: string[];
}

const LLM_SYSTEM = `You are a contract risk analyst. Read the contract and return a qualitative risk score from 0 to 40, based on factors NOT already captured by structured attributes (e.g., unusual termination terms, vague performance obligations, concentration risk, audit exposure, uncapped indemnities, exclusivity risks). Return ONLY valid JSON.`;

export async function scoreLLM(fullText: string): Promise<{ points: number; reasons: string[] }> {
  const truncated = fullText.length > 10000 ? fullText.slice(0, 10000) : fullText;
  const schemaHint = `{ "risk_score": <int 0-40>, "reasons": [<string>, ...] }`;
  try {
    const r = await chatJSON<LLMSignal>({
      system: LLM_SYSTEM,
      prompt: `Contract:\n\n${truncated}\n\nProduce qualitative risk score + reasons.`,
      schemaHint,
      temperature: 0.2,
    });
    const pts = Math.max(0, Math.min(40, Math.round(r.risk_score ?? 0)));
    const reasons = Array.isArray(r.reasons) ? r.reasons.slice(0, 6) : [];
    return { points: pts, reasons };
  } catch (e) {
    if (e instanceof OllamaError) {
      return { points: 0, reasons: [`LLM signal unavailable: ${e.message}`] };
    }
    throw e;
  }
}

// ── Combined score + category ────────────────────────────────────────────────
export function categorize(score: number): RiskCategory {
  if (score >= 75) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export async function scoreRisk(
  attributes: ContractAttributes,
  fullText: string
): Promise<RiskResult> {
  const inputs = extractRiskInputs(attributes);
  const rules = scoreRules(inputs);
  const llm = await scoreLLM(fullText);
  const score = Math.min(100, rules.points + llm.points);
  const reasons = [...rules.reasons, ...llm.reasons];
  return { score, category: categorize(score), reasons };
}
