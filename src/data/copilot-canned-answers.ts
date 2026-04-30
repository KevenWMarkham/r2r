// Canned-mode NOAH Help responses. Answers are built from live state
// (contracts + JE store), so question variants on the same topic produce
// distinct, accurate replies that reflect what's currently in the demo.

import type { ContractSummary, ProposedJERecord } from "@/lib/api-client";
import { seedPnL, topVariancesByDollar } from "@/data/seed-pnl";

export interface CannedAnswer {
  match: RegExp;
  reply: string;
}

export interface AnswerContext {
  contracts: ContractSummary[];
  jes: ProposedJERecord[];
  closeDay?: number;
  activePhase?: string | null;
}

const ACCRUED_ACCOUNTS = new Set(["2310", "2311", "2320", "2330"]);

interface JELine { account: string; accountName?: string; debit?: number; credit?: number; }
interface JEBody { description?: string; lines?: JELine[]; reversalDate?: string | null; }

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function jeBody(je: ProposedJERecord): JEBody {
  return (je.je_body ?? {}) as JEBody;
}

function accruedAmount(je: ProposedJERecord): number {
  return (jeBody(je).lines ?? [])
    .filter((l) => ACCRUED_ACCOUNTS.has(l.account))
    .reduce((s, l) => s + (l.credit ?? 0), 0);
}

export function buildCannedAnswers(ctx: AnswerContext): CannedAnswer[] {
  const { contracts, jes } = ctx;
  const total = contracts.length;
  const highRisk = contracts.filter((c) => c.risk_category === "High");
  const medRisk = contracts.filter((c) => c.risk_category === "Medium");
  const lowRisk = contracts.filter((c) => c.risk_category === "Low");
  const leaseFlagged = contracts.filter((c) => c.lease_flagged);
  const derivFlagged = contracts.filter((c) => c.derivative_flagged);
  const processed = contracts.filter((c) => c.agent_status?.extract === "done").length;
  const unprocessed = total - processed;

  const byTcv = (a: ContractSummary, b: ContractSummary) => {
    const va = parseFloat((a.tcv ?? "0").replace(/[^0-9.]/g, "")) || 0;
    const vb = parseFloat((b.tcv ?? "0").replace(/[^0-9.]/g, "")) || 0;
    return vb - va;
  };
  const byTcvSorted = [...contracts].sort(byTcv);

  // ── JE / Accrual stats ─────────────────────────────────────────────────────
  const submitted = jes.filter((j) => j.status === "submitted");
  const posted = jes.filter((j) => j.status === "posted");
  const reversed = jes.filter((j) => j.status === "reversed");
  const dualPending = submitted.filter((j) => j.materiality_tier === "exec");
  const managerPending = submitted.filter((j) => j.materiality_tier === "controller");
  const seniorPending = submitted.filter((j) => j.materiality_tier === "manager");
  const autoPosted = posted.filter((j) => j.materiality_tier === "standard");
  const accruedTotal = jes
    .filter((j) => j.status === "posted" || j.status === "submitted")
    .reduce((s, j) => s + accruedAmount(j), 0);
  const today = new Date().toISOString().slice(0, 10);
  const scheduledRev = posted.filter((j) => j.reversal_date && j.reversal_date > today && !j.reversed_at);

  // ── P&L variance ───────────────────────────────────────────────────────────
  const topVar = topVariancesByDollar(3);

  // ── Helper formatters ──────────────────────────────────────────────────────
  const briefList = (cs: ContractSummary[], n = 3): string =>
    cs
      .slice(0, n)
      .map((c) => `${c.counterparty ?? c.filename}${c.tcv ? ` (${c.tcv})` : ""}${c.risk_score != null ? ` · risk ${c.risk_score}` : ""}`)
      .join("; ");

  const jeBrief = (j: ProposedJERecord): string =>
    `${j.counterparty ?? j.filename ?? "—"} ${fmtCompact(parseFloat(j.total_amount))}`;

  const cockpit =
    ctx.activePhase
      ? `Cockpit: Day ${ctx.closeDay} of 6 · ${ctx.activePhase.toUpperCase()} phase active.`
      : "Cockpit is idle — start it from the Close Cockpit tab to drive the phase animation.";

  // Order matters: more specific patterns first.
  return [
    // ────────────── Contracts ──────────────
    {
      match: /(how many|count|number).*contract|contract.*count/i,
      reply:
        `${total} contracts in scope this period — ${highRisk.length} High risk, ${medRisk.length} Medium, ${lowRisk.length} Low. ${processed === total ? "All processed." : `${unprocessed} still need extract → risk → tech-acct.`}`,
    },
    {
      match: /(highest|top|riskiest|biggest).*risk.*contract|high.*risk.*contract|which.*contracts.*risk/i,
      reply:
        highRisk.length === 0
          ? "No High-risk contracts in the queue right now. Run extract on /contracts to score them."
          : `${highRisk.length} High-risk contract${highRisk.length === 1 ? "" : "s"}: ${briefList(highRisk, 5)}. Open /contracts and click Review for any of them.`,
    },
    {
      match: /(largest|biggest|top).*contract|contract.*by.*tcv|contract.*by.*value/i,
      reply:
        byTcvSorted.length === 0
          ? "No contracts with TCV available."
          : `Top by TCV: ${briefList(byTcvSorted, 3)}.`,
    },
    {
      match: /(asc.?842|lease.*flag|lease.*review|lease.*account)/i,
      reply:
        leaseFlagged.length === 0
          ? "No contracts currently flagged for ASC 842 lease review."
          : `${leaseFlagged.length} contract${leaseFlagged.length === 1 ? "" : "s"} flagged for ASC 842 lease review: ${briefList(leaseFlagged, 5)}.`,
    },
    {
      match: /(asc.?815|derivative|embedded.*deriv|hedge)/i,
      reply:
        derivFlagged.length === 0
          ? "No contracts flagged for ASC 815 embedded-derivative review."
          : `${derivFlagged.length} contract${derivFlagged.length === 1 ? "" : "s"} flagged for ASC 815: ${briefList(derivFlagged, 5)}.`,
    },
    {
      match: /contract/i,
      reply:
        `${total} contracts in the queue (${highRisk.length} High / ${medRisk.length} Medium / ${lowRisk.length} Low). Open /contracts → tick the ones you want and click "Run selected" or "Calculate accruals". Tech-acct flags currently flag ${leaseFlagged.length} lease${leaseFlagged.length === 1 ? "" : "s"} and ${derivFlagged.length} derivative${derivFlagged.length === 1 ? "" : "s"}.`,
    },

    // ────────────── Accruals / JEs ──────────────
    {
      match: /(total.*accru|accru.*total|accrued.*expense|accrued.*balance)/i,
      reply:
        accruedTotal === 0
          ? "No accrued-expense balance from reviewed contracts yet. Tick contracts on /contracts and click Calculate accruals → Submit all to populate."
          : `Total accrued expense from reviewed contracts: ${fmt(accruedTotal)}. ${posted.length} posted, ${submitted.length} pending review, ${reversed.length} already auto-reversed. See the B/S Variance Analysis tab on /narrative for the line-item breakdown.`,
    },
    {
      match: /(pending.*review|awaiting.*approval|to.*approve|review.*queue|pending.*manager|pending.*director)/i,
      reply:
        submitted.length === 0
          ? "JE Review Queue is empty — no JEs awaiting approval right now."
          : `${submitted.length} JE${submitted.length === 1 ? "" : "s"} awaiting approval: ${dualPending.length} dual-approval (>$5M), ${managerPending.length} Manager ($1M-$5M), ${seniorPending.length} Senior Accountant ($100K-$1M). Top pending: ${submitted.slice(0, 3).map(jeBrief).join("; ")}. Open /review to act.`,
    },
    {
      match: /(auto.?post|standard.*tier|under.*100k|below.*100k)/i,
      reply:
        autoPosted.length === 0
          ? "No JEs auto-posted (<$100K) this period yet."
          : `${autoPosted.length} JE${autoPosted.length === 1 ? "" : "s"} auto-posted under the $100K threshold: ${autoPosted.slice(0, 3).map(jeBrief).join("; ")}.`,
    },
    {
      match: /(reversal|reverse|auto.?reverse|f.81)/i,
      reply:
        scheduledRev.length === 0
          ? `${reversed.length} JE${reversed.length === 1 ? " has" : "s have"} already auto-reversed; none currently scheduled. Reversals inherit the original approver's authority and post on the reversal_date with no separate sign-off (matches SAP F.81 / BlackLine policy).`
          : `${scheduledRev.length} JE${scheduledRev.length === 1 ? "" : "s"} scheduled for auto-reversal: ${scheduledRev.slice(0, 3).map((j) => `${j.counterparty ?? j.filename} on ${j.reversal_date}`).join("; ")}. Each posts in the next period under the original approver — no manual click required.`,
    },
    {
      match: /accrual/i,
      reply:
        `Reviewed-contract accrual state: ${fmt(accruedTotal)} on the books (${posted.length} posted + ${submitted.length} pending). Routing breakdown — Dual approval: ${dualPending.length}, Manager: ${managerPending.length}, Senior Accountant: ${seniorPending.length}, Auto-posted: ${autoPosted.length}. Calculate fresh accruals from /contracts.`,
    },

    // ────────────── Materiality / approval ──────────────
    {
      match: /(materiality|threshold|approval.*tier|dual.*approval|who.*approves)/i,
      reply:
        "Materiality routing: <$100K auto-post · $100K-$1M → Senior Accountant · $1M-$5M → Manager · >$5M → Manager + Director (dual approval). Approving fires the Posting Agent → BlackLine → SAP. Reversals inherit the original approval — no separate sign-off needed.",
    },

    // ────────────── Close status / Cockpit ──────────────
    {
      match: /(close.*status|where.*are.*we|current.*phase|what.*phase|cockpit.*state)/i,
      reply: cockpit,
    },
    {
      match: /(close.*on.*time|finish.*on.*time|how.*long|days.*left|when.*done|predict.*close)/i,
      reply:
        ctx.activePhase
          ? `Day ${ctx.closeDay} of 6 — ${6 - (ctx.closeDay ?? 0)} day${6 - (ctx.closeDay ?? 0) === 1 ? "" : "s"} to Gate. Currently in ${ctx.activePhase.toUpperCase()}. On track if no exceptions block the next phase.`
          : "Close cockpit isn't running yet. Open the Close Cockpit tab and click Start to begin the simulation; the dashboard projects against a 6-day target.",
    },
    {
      match: /(phase|consolidate|validate|gate|pre.?close|execute)/i,
      reply:
        "Five phases: Pre-Close (Day -1) → Execute (Day 1-3) → Consolidate (Day 4) → Validate (Day 5-6) → Gate (Day 6). " + cockpit,
    },

    // ────────────── Variance / P&L ──────────────
    {
      match: /(variance|p.?and.?l|p\&l|biggest.*move|top.*variance|line.*item)/i,
      reply:
        `Top 3 P&L variances: ${topVar.map((v) => `${v.lineItem} ${v.variance >= 0 ? "+" : ""}${fmtCompact(v.variance)} (${v.variancePct >= 0 ? "+" : ""}${v.variancePct.toFixed(1)}%)`).join("; ")}. Open /narrative → P&L Variance Analysis and click Generate to draft commentary. P&L total revenue ${fmtCompact(seedPnL.filter(l => l.category === "Revenue").reduce((s, l) => s + l.currentPeriod, 0))} this period.`,
    },
    {
      match: /(balance.*sheet|accrued.*liab|assets|liabilities|bs)/i,
      reply:
        `B/S variance view is on /narrative → B/S Variance Analysis. Accrued Liabilities is contract-driven: base + ${fmt(accruedTotal)} from ${posted.length + submitted.length} reviewed-contract JE${posted.length + submitted.length === 1 ? "" : "s"}. Click any line to generate commentary.`,
    },
    {
      match: /(exec.*summary|executive|board|cfo.*memo|narrative)/i,
      reply:
        "Executive Summary lives on /narrative → Executive Summary. It pulls from live close metrics (cockpit day + phase) and top P&L variances. If the cockpit is idle it falls back to a 5.2-day baseline.",
    },

    // ────────────── Exceptions / risk ──────────────
    {
      match: /(exception|exceptions|recon|reconcil)/i,
      reply:
        `Exceptions surface in two places: skipped/failed JEs on the Calculate-accruals batch (missing inputs or tech-acct gating) and rejected JEs in /review. Currently ${highRisk.length} High-risk contract${highRisk.length === 1 ? "" : "s"} would warrant additional reviewer eyes — ${highRisk.slice(0, 2).map((c) => c.counterparty ?? c.filename).join(", ") || "none"}.`,
    },
    {
      match: /(entity|entities|region|na|emea|apla|china)/i,
      reply:
        "6 entities in scope: NA, EMEA, Greater China, APLA, Corporate, Global. The cockpit animates entity progression as phases advance — NA leads, EMEA next, then GC/APLA, with Corporate and Global folding in at consolidation.",
    },

    // ────────────── How-to ──────────────
    {
      match: /(how.*do.*i|how.*to|workflow|process|getting.*started)/i,
      reply:
        "Demo flow: 1) Open /contracts, tick contracts, click Run selected (extract → risk → tech-acct). 2) Click Calculate accruals → review the JEs → Submit all. 3) Open /review, expand any row to see line detail + calc, click Approve. 4) Open /narrative for variance/exec/balance-sheet commentary. 5) Hit (Demo) advance clock on /review to fast-forward auto-reversals.",
    },

    // ────────────── Fallback ──────────────
    {
      match: /.*/,
      reply:
        "I can answer specific questions about: contract count, highest-risk contracts, ASC 842/815 flags, total accrued expense, JEs pending review, materiality routing, close-status (cockpit), top variances, or balance sheet. Try \"how many contracts?\" or \"what's pending review?\".",
    },
  ];
}
