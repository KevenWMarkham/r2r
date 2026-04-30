import { useEffect, useMemo, useState } from "react";
import {
  listAllJEs,
  listContracts,
  type ProposedJERecord,
  type ContractSummary,
} from "@/lib/api-client";
import { subscribeJEStore } from "@/lib/canned-je-store";
import { IS_CANNED } from "@/config/env";
import { seedBalanceSheet, type BalanceSheetLine } from "@/data/seed-balance-sheet";
import { Play, Clipboard, Check, Loader2 } from "lucide-react";
import clsx from "clsx";

interface JELine {
  account: string;
  accountName?: string;
  debit?: number;
  credit?: number;
}
interface JEBody {
  description?: string;
  lines?: JELine[];
}

// Accrued-liability + related accrual accounts that NOAH credits.
const ACCRUED_ACCOUNTS = new Set(["2310", "2311", "2320", "2330"]);

interface ContractContribution {
  je: ProposedJERecord;
  contract?: ContractSummary;
  amount: number;
  account: string;
}

interface Commentary {
  commentary: string;
  drivers: string[];
  flags: string[];
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtFull(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pctColor(pct: number): string {
  if (pct >= 2) return "text-status-green";
  if (pct <= -2) return "text-status-red";
  return "text-brand-text-muted";
}

function getJEBody(je: ProposedJERecord): JEBody {
  return (je.je_body ?? {}) as JEBody;
}

function buildContractContributions(
  jes: ProposedJERecord[],
  contractsById: Map<string, ContractSummary>
): ContractContribution[] {
  const out: ContractContribution[] = [];
  for (const je of jes) {
    if (je.status !== "posted" && je.status !== "submitted") continue;
    const body = getJEBody(je);
    for (const ln of body.lines ?? []) {
      const credit = ln.credit ?? 0;
      if (!credit || credit <= 0) continue;
      if (!ACCRUED_ACCOUNTS.has(ln.account)) continue;
      out.push({
        je,
        contract: contractsById.get(je.contract_id),
        amount: credit,
        account: ln.account,
      });
    }
  }
  out.sort((a, b) => b.amount - a.amount);
  return out;
}

function tcvNumber(c: ContractSummary): number {
  if (!c.tcv) return 0;
  return parseFloat(c.tcv.replace(/[^0-9.]/g, "")) || 0;
}

// Commentary for the live, contract-driven Accrued Liabilities row.
// `contracts` is the full reviewed-contract portfolio so we can describe the
// underlying analysis even when no JEs have been submitted yet.
function commentaryForAccrued(
  line: BalanceSheetLine,
  contributions: ContractContribution[],
  contracts: ContractSummary[]
): Commentary {
  const today = new Date().toISOString().slice(0, 10);
  const live = contributions.reduce((s, c) => s + c.amount, 0);
  const variance = line.variance;
  const variancePct = line.variancePct;
  const top3 = contributions.slice(0, 3);
  const topStr = top3
    .map((c) => `${c.je.counterparty ?? c.je.filename ?? "—"} (${fmtFull(c.amount)})`)
    .join(", ");
  const byTier: Record<string, number> = {};
  let scheduledRev = 0;
  const contractIds = new Set<string>();
  for (const c of contributions) {
    contractIds.add(c.je.contract_id);
    const t = c.je.materiality_tier ?? "unknown";
    byTier[t] = (byTier[t] ?? 0) + c.amount;
    if (c.je.reversal_date && c.je.reversal_date > today && !c.je.reversed_at) scheduledRev++;
  }

  // ── Underlying portfolio analysis (always shown) ────────────────────────────
  const reviewed = contracts.filter((c) => c.agent_status?.extract === "done");
  const high = reviewed.filter((c) => c.risk_category === "High");
  const medium = reviewed.filter((c) => c.risk_category === "Medium");
  const low = reviewed.filter((c) => c.risk_category === "Low");
  const leaseFlaggedContracts = reviewed.filter((c) => c.lease_flagged);
  const derivFlaggedContracts = reviewed.filter((c) => c.derivative_flagged);
  const portfolioByTcv = [...reviewed].sort((a, b) => tcvNumber(b) - tcvNumber(a));
  const top3Tcv = portfolioByTcv.slice(0, 3);
  const totalTcv = reviewed.reduce((s, c) => s + tcvNumber(c), 0);
  const submittedContractIds = new Set(contributions.map((c) => c.je.contract_id));
  const pendingPipeline = reviewed.filter((c) => !submittedContractIds.has(c.id));

  const sentences: string[] = [];
  sentences.push(
    `Accrued Liabilities of ${fmtFull(line.currentPeriod)} at period end (${variance >= 0 ? "+" : ""}${fmtFull(variance)}, ${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}% vs prior year end of ${fmtFull(line.priorPeriod)}).`
  );
  if (live > 0) {
    sentences.push(
      `${fmtFull(live)} of the balance is driven by ${contractIds.size} reviewed contract${contractIds.size === 1 ? "" : "s"} processed through the agentic pipeline this period.`
    );
    if (top3.length > 0) {
      sentences.push(`Largest contributors: ${topStr}.`);
    }
  } else {
    sentences.push(`Movement reflects routine accrual reversals net of new period accruals; no incremental contract-driven JEs posted this period.`);
  }
  if (scheduledRev > 0) {
    sentences.push(
      `${scheduledRev} contract-driven entr${scheduledRev === 1 ? "y has" : "ies have"} a scheduled auto-reversal in the following period under the original approver's authority.`
    );
  }

  // Always-on "underlying contracts" paragraph: portfolio composition + ASC flags
  if (reviewed.length > 0) {
    const flagParts: string[] = [];
    if (leaseFlaggedContracts.length > 0) {
      flagParts.push(`${leaseFlaggedContracts.length} flagged for ASC 842 lease review (${leaseFlaggedContracts.slice(0, 2).map((c) => c.counterparty ?? c.filename).join(", ")})`);
    }
    if (derivFlaggedContracts.length > 0) {
      flagParts.push(`${derivFlaggedContracts.length} flagged for ASC 815 embedded-derivative review (${derivFlaggedContracts.slice(0, 2).map((c) => c.counterparty ?? c.filename).join(", ")})`);
    }
    const portfolioStr = top3Tcv
      .map((c) => `${c.counterparty ?? c.filename}${c.tcv ? ` (${c.tcv})` : ""}`)
      .join(", ");
    sentences.push(
      `Underlying contract portfolio: ${reviewed.length} reviewed contract${reviewed.length === 1 ? "" : "s"} totaling ${fmtFull(totalTcv)} TCV — ${high.length} High risk, ${medium.length} Medium, ${low.length} Low.${flagParts.length ? " " + flagParts.join("; ") + "." : ""} Top by TCV: ${portfolioStr}.`
    );
    if (pendingPipeline.length > 0 && live === 0) {
      sentences.push(
        `${pendingPipeline.length} reviewed contract${pendingPipeline.length === 1 ? " has" : "s have"} no accrual JE submitted this period — once the controller runs Calculate accruals → Submit all on /contracts, the corresponding GL 2310 credits will flow into this balance.`
      );
    } else if (pendingPipeline.length > 0 && live > 0) {
      sentences.push(
        `${pendingPipeline.length} additional reviewed contract${pendingPipeline.length === 1 ? "" : "s"} ${pendingPipeline.length === 1 ? "is" : "are"} not yet contributing — accruals can be calculated and submitted on /contracts to roll them in.`
      );
    }
  }

  const drivers: string[] = [];
  if (live > 0) {
    drivers.push(`Contract-driven additions: ${fmtFull(live)} across ${contributions.length} JE${contributions.length === 1 ? "" : "s"}`);
    if ((byTier.exec ?? 0) > 0) drivers.push(`Manager + Director (dual) tier: ${fmtFull(byTier.exec)}`);
    if ((byTier.controller ?? 0) > 0) drivers.push(`Manager tier: ${fmtFull(byTier.controller)}`);
    if ((byTier.manager ?? 0) > 0) drivers.push(`Senior Accountant tier: ${fmtFull(byTier.manager)}`);
    if ((byTier.standard ?? 0) > 0) drivers.push(`Auto-posted (<$100K): ${fmtFull(byTier.standard)}`);
    drivers.push(`Top contributor: ${top3[0]?.je.counterparty ?? "—"} (${fmtFull(top3[0]?.amount ?? 0)})`);
  } else {
    drivers.push("No new contract-driven accruals this period");
    drivers.push(`Net change ${variance >= 0 ? "+" : ""}${fmtFull(variance)} is from routine BAU accruals + reversals`);
  }
  // Always include portfolio-level drivers so the controller sees the underlying analysis
  if (reviewed.length > 0) {
    drivers.push(`Reviewed contract portfolio: ${reviewed.length} contracts · ${fmtFull(totalTcv)} aggregate TCV`);
    drivers.push(`Risk distribution: ${high.length} High / ${medium.length} Medium / ${low.length} Low`);
    if (top3Tcv.length > 0) {
      drivers.push(`Top by TCV: ${top3Tcv.map((c) => `${c.counterparty ?? c.filename} ${c.tcv ?? ""}`).join("; ")}`);
    }
    if (pendingPipeline.length > 0) {
      drivers.push(`Pipeline: ${pendingPipeline.length} reviewed contract${pendingPipeline.length === 1 ? "" : "s"} not yet accrued`);
    }
  }

  const flags: string[] = [];
  if (scheduledRev > 0) {
    flags.push(`${scheduledRev} auto-reversal${scheduledRev === 1 ? "" : "s"} pending — will post in the next period without separate sign-off.`);
  }
  // Surface ASC flags from BOTH contributing JEs and the broader portfolio so
  // the controller sees lease/derivative exposure even when nothing has posted.
  const leaseInPortfolio = leaseFlaggedContracts.length;
  const derivInPortfolio = derivFlaggedContracts.length;
  if (leaseInPortfolio > 0) {
    flags.push(`${leaseInPortfolio} reviewed contract${leaseInPortfolio === 1 ? "" : "s"} flagged for ASC 842 lease review — verify accrual basis when these post.`);
  }
  if (derivInPortfolio > 0) {
    flags.push(`${derivInPortfolio} reviewed contract${derivInPortfolio === 1 ? "" : "s"} flagged for ASC 815 embedded-derivative review.`);
  }
  const pendingHigh = contributions.filter((c) => c.je.status === "submitted" && c.je.materiality_tier === "exec");
  if (pendingHigh.length > 0) {
    flags.push(`${pendingHigh.length} entr${pendingHigh.length === 1 ? "y" : "ies"} > $5M still pending dual approval.`);
  }
  // High-risk contracts in the portfolio with no accrual yet — disclosure exposure
  const highRiskNoJE = high.filter((c) => !submittedContractIds.has(c.id));
  if (highRiskNoJE.length > 0) {
    flags.push(`${highRiskNoJE.length} High-risk contract${highRiskNoJE.length === 1 ? "" : "s"} (${highRiskNoJE.slice(0, 2).map((c) => c.counterparty ?? c.filename).join(", ")}) have no accrual submitted — confirm whether period-end recognition is required.`);
  }

  return { commentary: sentences.join(" "), drivers, flags };
}

// Generic deterministic commentary for non-contract-driven lines.
function commentaryForLine(line: BalanceSheetLine): Commentary {
  const variance = line.variance;
  const variancePct = line.variancePct;
  const direction = variance >= 0 ? "increased" : "decreased";

  const sentences: string[] = [];
  sentences.push(
    `${line.lineItem} ${direction} to ${fmtFull(line.currentPeriod)} at period end, ${variance >= 0 ? "+" : ""}${fmtFull(variance)} (${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}%) versus prior year end of ${fmtFull(line.priorPeriod)}.`
  );
  sentences.push(line.driver);

  const drivers: string[] = [
    `Category: ${line.category}`,
    `Current period end: ${fmtFull(line.currentPeriod)}`,
    `Prior year end: ${fmtFull(line.priorPeriod)}`,
    `YoY change: ${variance >= 0 ? "+" : ""}${fmtFull(variance)} (${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}%)`,
  ];

  const flags: string[] = [];
  if (Math.abs(variancePct) >= 10) {
    flags.push(`Material movement (>10%) — confirm driver and consider disclosure.`);
  }
  return { commentary: sentences.join(" "), drivers, flags };
}

export default function BalanceSheetNarrative() {
  const [jes, setJes] = useState<ProposedJERecord[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BalanceSheetLine | null>(seedBalanceSheet[0] ?? null);
  const [commentaries, setCommentaries] = useState<Record<string, Commentary>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const refresh = async () => {
    setLoading(true);
    try {
      const [jeList, contractList] = await Promise.all([listAllJEs(), listContracts()]);
      setJes(jeList);
      setContracts(contractList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!IS_CANNED) return;
    return subscribeJEStore(() => { void refresh(); });
  }, []);

  const contractsById = useMemo(() => {
    const m = new Map<string, ContractSummary>();
    for (const c of contracts) m.set(c.id, c);
    return m;
  }, [contracts]);

  const contributions = useMemo(
    () => buildContractContributions(jes, contractsById),
    [jes, contractsById]
  );

  // Adjust the live Accrued Liabilities row to reflect contract-driven additions.
  // Prior year end stays seeded; current period end = seeded base + live contract delta.
  const lines = useMemo<BalanceSheetLine[]>(() => {
    const liveAdd = contributions.reduce((s, c) => s + c.amount, 0);
    return seedBalanceSheet.map((l) => {
      if (!l.contractDriven) return l;
      const newCurrent = l.currentPeriod + liveAdd;
      const variance = newCurrent - l.priorPeriod;
      const variancePct = l.priorPeriod !== 0 ? (variance / l.priorPeriod) * 100 : 0;
      return {
        ...l,
        currentPeriod: newCurrent,
        variance,
        variancePct: Math.round(variancePct * 10) / 10,
      };
    });
  }, [contributions]);

  // If the selected line drifted (contract-driven recompute), pick the matching id
  const selectedLine = useMemo(
    () => (selected ? lines.find((l) => l.id === selected.id) ?? null : null),
    [selected, lines]
  );

  const generate = (line: BalanceSheetLine) => {
    setSelected(line);
    setRunningIds((s) => new Set(s).add(line.id));
    // Deterministic — no LLM call. Tiny dwell to mimic the variance UX.
    window.setTimeout(() => {
      const c = line.contractDriven
        ? commentaryForAccrued(line, contributions, contracts)
        : commentaryForLine(line);
      setCommentaries((prev) => ({ ...prev, [line.id]: c }));
      setRunningIds((s) => {
        const next = new Set(s);
        next.delete(line.id);
        return next;
      });
    }, 350);
  };

  const generateAll = () => {
    for (const l of lines) {
      if (commentaries[l.id]) continue;
      generate(l);
    }
  };

  const selectedCommentary = selectedLine ? commentaries[selectedLine.id] ?? null : null;
  const selectedRunning = selectedLine ? runningIds.has(selectedLine.id) : false;
  const anyRunning = runningIds.size > 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="border border-status-red/60 bg-status-red/10 text-status-red p-3 text-sm font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1fr_420px] gap-[2px]">
        <BalanceSheetTable
          lines={lines}
          commentaries={commentaries}
          runningIds={runningIds}
          selectedId={selectedLine?.id ?? null}
          onSelect={setSelected}
          onGenerate={generate}
          onGenerateAll={generateAll}
          anyRunning={anyRunning}
          loading={loading}
        />
        <BSCommentaryPanel
          line={selectedLine}
          commentary={selectedCommentary}
          running={selectedRunning}
        />
      </div>
    </div>
  );
}

function BalanceSheetTable({
  lines,
  commentaries,
  runningIds,
  selectedId,
  onSelect,
  onGenerate,
  onGenerateAll,
  anyRunning,
  loading,
}: {
  lines: BalanceSheetLine[];
  commentaries: Record<string, Commentary | undefined>;
  runningIds: Set<string>;
  selectedId: string | null;
  onSelect: (line: BalanceSheetLine) => void;
  onGenerate: (line: BalanceSheetLine) => void;
  onGenerateAll: () => void;
  anyRunning: boolean;
  loading: boolean;
}) {
  return (
    <div className="bg-brand-surface border border-brand-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
        <div className="font-display text-sm font-bold uppercase tracking-wider">
          B/S Variance · Period End vs Prior Year End
          {loading && <Loader2 size={11} className="inline-block ml-2 animate-spin text-brand-text-dim" />}
        </div>
        <button
          onClick={onGenerateAll}
          disabled={anyRunning}
          className="px-3 py-1.5 bg-brand-accent text-black font-display font-bold uppercase text-[11px] tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Play size={10} />
          Generate all
        </button>
      </div>

      <div className="divide-y divide-brand-border">
        {lines.map((line) => {
          const isSelected = selectedId === line.id;
          const isRunning = runningIds.has(line.id);
          const hasCommentary = !!commentaries[line.id];
          return (
            <div
              key={line.id}
              onClick={() => onSelect(line)}
              className={clsx(
                "grid grid-cols-[1fr_100px_100px_100px_70px_90px] gap-3 px-4 py-2 items-center text-xs cursor-pointer transition-colors",
                isSelected && "bg-brand-accent-dim",
                !isSelected && "hover:bg-brand-surface-alt"
              )}
            >
              <div>
                <div className="font-medium text-brand-text">
                  {line.lineItem}
                  {line.contractDriven && (
                    <span className="ml-2 font-display text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 border border-brand-accent/40 text-brand-accent bg-brand-accent-dim/40">
                      Contracts
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-brand-text-dim uppercase tracking-wider">
                  {line.category}
                </div>
              </div>
              <div className="font-mono text-right tabular-nums text-brand-text">
                {fmt(line.currentPeriod)}
              </div>
              <div className="font-mono text-right tabular-nums text-brand-text-muted">
                {fmt(line.priorPeriod)}
              </div>
              <div
                className={clsx(
                  "font-mono text-right tabular-nums",
                  line.variance >= 0 ? "text-status-green" : "text-status-red"
                )}
              >
                {line.variance >= 0 ? "+" : ""}
                {fmt(line.variance)}
              </div>
              <div className={clsx("font-mono text-right tabular-nums", pctColor(line.variancePct))}>
                {line.variancePct >= 0 ? "+" : ""}
                {line.variancePct.toFixed(1)}%
              </div>
              <div className="flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerate(line);
                  }}
                  disabled={isRunning}
                  className={clsx(
                    "px-2 py-1 border font-display font-semibold uppercase text-[9px] tracking-wider",
                    hasCommentary
                      ? "border-status-green/60 bg-status-green/10 text-status-green"
                      : "border-brand-border hover:border-brand-accent hover:text-brand-accent",
                    isRunning && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isRunning ? "..." : hasCommentary ? "Re-run" : "Generate"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BSCommentaryPanel({
  line,
  commentary,
  running,
}: {
  line: BalanceSheetLine | null;
  commentary: Commentary | null;
  running: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!line) {
    return (
      <div className="bg-brand-surface border border-brand-border p-5 h-full flex items-center justify-center text-sm text-brand-text-muted italic">
        Select a line item to generate commentary.
      </div>
    );
  }

  const copy = async () => {
    if (!commentary) return;
    const text = [
      `${line.lineItem} — ${line.variance >= 0 ? "+" : ""}${line.variance.toLocaleString()} (${line.variancePct.toFixed(1)}%)`,
      "",
      commentary.commentary,
      "",
      "Drivers:",
      ...commentary.drivers.map((d) => `  • ${d}`),
      ...(commentary.flags.length
        ? ["", "Risk flags:", ...commentary.flags.map((r) => `  ! ${r}`)]
        : []),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="bg-brand-surface border border-brand-border p-5 space-y-4 h-full">
      <div>
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-1">
          Selected Line
        </div>
        <div className="font-display text-lg font-bold">{line.lineItem}</div>
        <div className="font-mono text-xs text-brand-text-muted mt-1">
          {line.variance >= 0 ? "+" : ""}${line.variance.toLocaleString()} ·{" "}
          {line.variancePct.toFixed(1)}% YoY
        </div>
      </div>

      {running ? (
        <div className="flex items-center gap-2 text-status-amber font-mono text-xs">
          <Loader2 size={14} className="animate-spin" />
          Drafting commentary…
        </div>
      ) : commentary ? (
        <>
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
              Commentary
            </div>
            <p className="text-sm text-brand-text leading-relaxed fade-in">
              {commentary.commentary}
            </p>
          </div>

          {commentary.drivers.length > 0 && (
            <div>
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-1">
                Key Drivers
              </div>
              <ul className="list-disc list-inside text-xs text-brand-text-muted space-y-0.5">
                {commentary.drivers.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {commentary.flags.length > 0 && (
            <div className="border-t border-brand-border pt-3">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-status-amber mb-1">
                Risk Flags
              </div>
              <ul className="list-disc list-inside text-xs text-status-amber space-y-0.5">
                {commentary.flags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              onClick={copy}
              className="flex-1 px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent hover:text-brand-accent flex items-center justify-center gap-1"
            >
              {copied ? <Check size={12} /> : <Clipboard size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : (
        <div className="text-sm text-brand-text-muted italic">
          Click Generate to draft commentary for this line.
        </div>
      )}
    </div>
  );
}
