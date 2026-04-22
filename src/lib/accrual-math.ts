// Pure TypeScript accrual math. Deterministic. No LLM. No I/O.
// LLM outputs never pollute JE dollar amounts — enforced by types.

export type AccrualMethod = "straight-line" | "immediate" | "direct-association";

export interface AccrualCalcInput {
  totalFee: number;          // dollars (parsed from string upstream)
  serviceStart: Date;
  serviceEnd: Date;
  periodEnd: Date;           // close-period end date
  method: AccrualMethod;
  billedToDate: number;      // dollars already invoiced (GR/IR proxy)
}

export interface AccrualCalcResult {
  periodAccrual: number;     // amount to accrue this period (can be 0)
  accruedCumulative: number; // total earned through periodEnd
  monthlyRate: number;       // for straight-line; 0 otherwise
  serviceMonths: number;
  monthsElapsed: number;     // through periodEnd, clamped to serviceMonths
  reasoning: string;         // human-readable calculation detail
}

// ── Money parsing (handles $4,200,000 / USD 1,500 / $4.2M / etc) ─────────────
export function parseCurrency(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[,$\sUSD£€¥]/gi, "").trim();
  const mMatch = cleaned.match(/^([\d.]+)\s*[mM]$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000 * 100) / 100;
  const bMatch = cleaned.match(/^([\d.]+)\s*[bB]$/);
  if (bMatch) return Math.round(parseFloat(bMatch[1]) * 1_000_000_000 * 100) / 100;
  const kMatch = cleaned.match(/^([\d.]+)\s*[kK]$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000 * 100) / 100;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// Parse natural-date strings or ISO to Date. Returns null on failure.
export function parseDate(input: string): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isFinite(d.getTime()) ? d : null;
}

// ── Core calculation ────────────────────────────────────────────────────────
function monthsBetween(a: Date, b: Date): number {
  const years = b.getFullYear() - a.getFullYear();
  const months = b.getMonth() - a.getMonth();
  const dayFrac = (b.getDate() - a.getDate()) / 30; // approximate
  return years * 12 + months + dayFrac;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateAccrual(input: AccrualCalcInput): AccrualCalcResult {
  const { totalFee, serviceStart, serviceEnd, periodEnd, method, billedToDate } = input;

  // Validate ordering
  if (serviceEnd <= serviceStart) {
    return {
      periodAccrual: 0,
      accruedCumulative: 0,
      monthlyRate: 0,
      serviceMonths: 0,
      monthsElapsed: 0,
      reasoning: "Service end date is not after service start date — cannot compute accrual.",
    };
  }

  const serviceMonths = Math.max(0, monthsBetween(serviceStart, serviceEnd));
  const monthlyRate = serviceMonths > 0 ? totalFee / serviceMonths : 0;

  // Period hasn't reached service start yet
  if (periodEnd < serviceStart) {
    return {
      periodAccrual: 0,
      accruedCumulative: 0,
      monthlyRate: round2(monthlyRate),
      serviceMonths: round2(serviceMonths),
      monthsElapsed: 0,
      reasoning: `Service has not started yet (starts ${serviceStart.toISOString().slice(0, 10)}, period end ${periodEnd.toISOString().slice(0, 10)}). Nothing earned; nothing to accrue.`,
    };
  }

  // Period after service end → fully earned
  const effectiveEnd = periodEnd > serviceEnd ? serviceEnd : periodEnd;
  const monthsElapsed = Math.max(0, monthsBetween(serviceStart, effectiveEnd));

  let accruedCumulative = 0;
  let reasoning = "";

  switch (method) {
    case "straight-line": {
      accruedCumulative = monthsElapsed * monthlyRate;
      reasoning = `Straight-line: $${round2(monthlyRate).toLocaleString()}/month × ${round2(monthsElapsed)} months elapsed = $${round2(accruedCumulative).toLocaleString()} earned through ${effectiveEnd.toISOString().slice(0, 10)}.`;
      break;
    }
    case "immediate": {
      accruedCumulative = totalFee;
      reasoning = `Immediate recognition: full $${round2(totalFee).toLocaleString()} recognized at service start (${serviceStart.toISOString().slice(0, 10)}).`;
      break;
    }
    case "direct-association": {
      // Without milestone data, fall back to straight-line as best-effort
      accruedCumulative = monthsElapsed * monthlyRate;
      reasoning = `Direct-association (best-effort straight-line in absence of milestone data): $${round2(monthlyRate).toLocaleString()}/month × ${round2(monthsElapsed)} months = $${round2(accruedCumulative).toLocaleString()}.`;
      break;
    }
  }

  // Net GR/IR
  const periodAccrual = Math.max(0, accruedCumulative - billedToDate);
  if (billedToDate > 0) {
    reasoning += ` Less $${round2(billedToDate).toLocaleString()} already billed (GR/IR): period accrual = $${round2(periodAccrual).toLocaleString()}.`;
  }

  return {
    periodAccrual: round2(periodAccrual),
    accruedCumulative: round2(accruedCumulative),
    monthlyRate: round2(monthlyRate),
    serviceMonths: round2(serviceMonths),
    monthsElapsed: round2(monthsElapsed),
    reasoning,
  };
}
