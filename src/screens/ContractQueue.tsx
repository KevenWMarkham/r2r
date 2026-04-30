import { useEffect, useMemo, useState } from "react";
import { listContracts, getContract, uploadContract, submitJE, type ContractSummary, type ContractDetail, type MaterialityTier, type JEStatus } from "@/lib/api-client";
import { AccrualGapError } from "@/agents/accrual";
import OllamaGuard from "@/components/OllamaGuard";
import { agent, type AgentEvent } from "@/adapters";
import { FileText, Upload, Play, X, ArrowRight, AlertCircle, CheckCircle2, Calculator } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUiStore } from "@/store/uiStore";
import { IS_CANNED } from "@/config/env";
import type { ContractAttributes } from "@/agents/contract-schema";
import type { RiskResult } from "@/agents/risk";
import type { TechAccountingFlags } from "@/agents/tech-accounting";
import RiskPanel from "@/components/RiskPanel";
import TechAccountingFlagsPanel from "@/components/TechAccountingFlags";
import AttributeChecklist from "@/components/AttributeChecklist";
import clsx from "clsx";

interface RunResult {
  contract: ContractSummary;
  status: "ok" | "error" | "skipped";
  error?: string;
}

interface AccrualResult {
  contract: ContractSummary;
  status: "calculated" | "submitted" | "auto-posted" | "skipped" | "error";
  amount?: number;
  tier?: MaterialityTier | null;
  jeStatus?: JEStatus;
  postingRef?: string | null;
  reversalDate?: string | null;
  period?: string;
  reason?: string;
  missing?: string[];
  // Held until Submit all fires — kept on the result so we can submit later
  je?: Record<string, unknown>;
}

const ROW_GRID = "grid-cols-[36px_24px_1fr_1fr_130px_90px_110px_120px_90px]";

// Session-scoped store of contract IDs that have been processed in THIS browser
// tab. The fixtures ship with full risk/flag data; this overlay lets the demo
// open with all rows in a "pending" state until the controller runs the
// agentic chain — then the rows reveal their risk badges + R/Y/G coloring.
const PROCESSED_KEY = "noah_processed_contract_ids";
function readProcessedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(PROCESSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function writeProcessedIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(PROCESSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export default function ContractQueue() {
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [runResults, setRunResults] = useState<RunResult[] | null>(null);
  const [accrualResults, setAccrualResults] = useState<AccrualResult[] | null>(null);
  // Session-scoped processed-state overlay. Empty on first load → all rows
  // render as "pending" with no risk/flag data shown. Run selected populates
  // this set, revealing the risk badges + R/Y/G row coloring.
  const [processedIds, setProcessedIds] = useState<Set<string>>(() => readProcessedIds());
  const navigate = useNavigate();

  const markProcessed = (ids: string[]) => {
    setProcessedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      writeProcessedIds(next);
      return next;
    });
  };

  const resetProcessed = () => {
    setProcessedIds(new Set());
    writeProcessedIds(new Set());
  };

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listContracts();
      // Sort: category bucket (High > Medium > Low > unscored), then risk_score
      // desc within bucket, then filename asc. Sorting on category first keeps
      // any High-tagged contract above all Mediums even when raw scores drift
      // close to the boundary after a tier recalibration.
      const rank: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
      list.sort((a, b) => {
        const aCat = rank[a.risk_category ?? ""] ?? 0;
        const bCat = rank[b.risk_category ?? ""] ?? 0;
        if (aCat !== bCat) return bCat - aCat;
        const aR = a.risk_score ?? -1;
        const bR = b.risk_score ?? -1;
        if (aR !== bR) return bR - aR;
        return a.filename.localeCompare(b.filename);
      });
      setContracts(list);
      // Default: select all on first load. Preserve user selection on subsequent
      // refreshes (e.g., after a run) by keeping any IDs that still exist.
      setSelectedIds((prev) => {
        if (prev.size === 0) return new Set(list.map((c) => c.id));
        const validIds = new Set(list.map((c) => c.id));
        const next = new Set<string>();
        for (const id of prev) if (validIds.has(id)) next.add(id);
        return next;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const allSelected = useMemo(
    () => contracts.length > 0 && contracts.every((c) => selectedIds.has(c.id)),
    [contracts, selectedIds]
  );
  const someSelected = useMemo(
    () => selectedIds.size > 0 && !allSelected,
    [selectedIds, allSelected]
  );

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(contracts.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runSelected = async () => {
    setRunningAll(true);
    setError(null);
    setRunResults(null);
    const targets = contracts.filter((c) => selectedIds.has(c.id));
    if (targets.length === 0) {
      setError("No contracts selected. Tick at least one row before clicking Run.");
      setRunningAll(false);
      return;
    }
    const results: RunResult[] = [];
    try {
      for (let i = 0; i < targets.length; i++) {
        const c = targets[i];
        const label = c.counterparty ?? c.filename;
        setRunProgress({ current: i + 1, total: targets.length, label: `${label} — extracting…` });
        try {
          const detail = await getContract(c.id);
          if (!detail.full_text) throw new Error("No contract text available");
          const pushActivity = {
            onEvent: (e: AgentEvent) => useUiStore.getState().pushAgentActivity(e, `contract:${c.id}`),
          };
          const { attributes } = await agent.extractAttributes(c.id, detail.full_text, pushActivity);
          setRunProgress({ current: i + 1, total: targets.length, label: `${label} — risk scoring…` });
          await agent.scoreRisk(c.id, attributes as unknown as ContractAttributes, detail.full_text, pushActivity);
          setRunProgress({ current: i + 1, total: targets.length, label: `${label} — tech-acct flagging…` });
          await agent.flagTechnicalAccounting(c.id, attributes as unknown as ContractAttributes, detail.full_text, pushActivity);
          results.push({ contract: c, status: "ok" });
          // Reveal this contract's risk + flags + R/Y/G row tint as soon as
          // its run completes — the next iteration of the loop will paint it.
          markProcessed([c.id]);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`Run failed for ${c.id}:`, e);
          results.push({ contract: c, status: "error", error: msg });
        }
      }
      await refresh();
      // Refreshed contracts now have updated risk_score / flags; re-resolve them in results
      const refreshedById = new Map<string, ContractSummary>();
      // We need the latest list — re-pull from listContracts has been done by refresh()
      // Use the state via a fresh fetch (cheap in canned, ok in live):
      const latest = await listContracts();
      for (const c of latest) refreshedById.set(c.id, c);
      const finalResults = results.map((r) => ({
        ...r,
        contract: refreshedById.get(r.contract.id) ?? r.contract,
      }));
      setRunResults(finalResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunProgress(null);
      setRunningAll(false);
    }
  };

  const calculateAccruals = async () => {
    setRunningAll(true);
    setError(null);
    setAccrualResults(null);
    const targets = contracts.filter((c) => selectedIds.has(c.id));
    if (targets.length === 0) {
      setError("No contracts selected. Tick at least one row before calculating accruals.");
      setRunningAll(false);
      return;
    }
    const results: AccrualResult[] = [];
    const periodEnd = endOfCurrentMonth();
    try {
      for (let i = 0; i < targets.length; i++) {
        const c = targets[i];
        const label = c.counterparty ?? c.filename;
        setRunProgress({ current: i + 1, total: targets.length, label: `${label} — calculating accrual…` });
        try {
          const detail = await getContract(c.id);
          if (!detail.full_text) throw new Error("No contract text available");
          if (!detail.attributes || Object.keys(detail.attributes).length === 0) {
            results.push({ contract: c, status: "skipped", reason: "Run extract first — no attributes available" });
            continue;
          }
          const pushActivity = {
            onEvent: (e: AgentEvent) => useUiStore.getState().pushAgentActivity(e, `accrual:${c.id}`),
          };
          const res = await agent.calculateAccrual(
            c.id,
            detail.counterparty ?? detail.filename,
            detail.attributes as unknown as ContractAttributes,
            detail.full_text,
            { periodEnd, billedToDate: 0 },
            pushActivity
          );
          // Compute the materiality tier so reviewers see routing in the modal
          // before submission. Mirrors routeByMateriality in canned-je-store.
          const amt = res.je.totalDebits;
          const tier: MaterialityTier =
            amt < 100_000 ? "standard" :
            amt < 1_000_000 ? "manager" :
            amt < 5_000_000 ? "controller" :
            "exec";
          results.push({
            contract: c,
            status: "calculated",
            amount: amt,
            tier,
            reversalDate: res.je.reversalDate,
            period: res.je.period,
            je: res.je as unknown as Record<string, unknown>,
          });
        } catch (e) {
          if (e instanceof AccrualGapError) {
            results.push({ contract: c, status: "skipped", reason: "Missing inputs", missing: e.missing });
          } else {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`Calculate accrual failed for ${c.id}:`, e);
            results.push({ contract: c, status: "error", reason: msg });
          }
        }
      }
      await refresh();
      setAccrualResults(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunProgress(null);
      setRunningAll(false);
    }
  };

  const submitAllCalculated = async () => {
    if (!accrualResults) return;
    const updated: AccrualResult[] = [];
    for (const r of accrualResults) {
      if (r.status !== "calculated" || !r.je) {
        updated.push(r);
        continue;
      }
      try {
        const je = r.je as { totalDebits: number; period: string; reversalDate: string };
        const record = await submitJE({
          contract_id: r.contract.id,
          period: je.period,
          je_body: r.je,
          total_amount: je.totalDebits,
          reversal_date: je.reversalDate,
          prepared_by: "Senior Accountant",
        });
        updated.push({
          ...r,
          status: record.status === "posted" ? "auto-posted" : "submitted",
          jeStatus: record.status,
          postingRef: record.posting_ref,
          reversalDate: record.reversal_date,
          tier: record.materiality_tier,
          je: undefined, // clear — already submitted
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updated.push({ ...r, status: "error", reason: `Submit failed: ${msg}` });
      }
    }
    setAccrualResults(updated);
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadContract(file);
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const goToRow = (id: string, e: React.MouseEvent) => {
    // Don't navigate if the click originated on the checkbox or its label
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-navigate]")) return;
    navigate(`/contracts/${id}`);
  };

  return (
    <OllamaGuard>
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">Contracts</h1>
          <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
            Risk-ranked contract queue. Tick the contracts you want to process, then click Run selected — NOAH extracts 27 attributes, scores risk, and flags technical accounting (ASC 840/842/815) on each. Rows reveal a R/Y/G band as agents complete.
          </p>
          {contracts.length > 0 && (
            <div className="text-[11px] font-mono text-brand-text-dim mt-2">
              {processedIds.size} of {contracts.length} processed this session
              {processedIds.size > 0 && (
                <button
                  type="button"
                  onClick={resetProcessed}
                  className="ml-3 underline hover:text-brand-accent"
                  title="Clear the session-scoped processed-state overlay so the queue renders unprocessed for a fresh demo"
                >
                  reset to unprocessed
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0 relative z-10">
          <button
            type="button"
            onClick={() => { void runSelected(); }}
            disabled={runningAll || selectedIds.size === 0}
            title={
              selectedIds.size === 0
                ? "Tick at least one contract to enable"
                : `Run extract → risk → tech-acct on ${selectedIds.size} selected contract${selectedIds.size === 1 ? "" : "s"}`
            }
            className="px-3 py-2 bg-brand-accent text-black font-display font-bold uppercase text-[11px] tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          >
            <Play size={12} />
            {runningAll ? "Running…" : `Run selected (${selectedIds.size})`}
          </button>
          <button
            type="button"
            onClick={() => { void calculateAccruals(); }}
            disabled={runningAll || selectedIds.size === 0}
            title={
              selectedIds.size === 0
                ? "Tick at least one contract to enable"
                : `Compute accrual + submit JE for each of the ${selectedIds.size} selected contract${selectedIds.size === 1 ? "" : "s"}`
            }
            className="px-3 py-2 bg-brand-surface-alt border border-brand-accent/60 text-brand-accent font-display font-bold uppercase text-[11px] tracking-wider hover:bg-brand-accent-dim disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          >
            <Calculator size={12} />
            Calculate accruals ({selectedIds.size})
          </button>
        </div>
      </div>

      {runProgress && (
        <div className="border border-status-amber/60 bg-status-amber/10 p-3 fade-in">
          <div className="flex items-center justify-between text-xs font-mono text-status-amber">
            <span>
              Processing {runProgress.current} of {runProgress.total} — {runProgress.label}
            </span>
            <span>
              {Math.round((runProgress.current / runProgress.total) * 100)}%
            </span>
          </div>
          <div className="mt-2 h-1 bg-brand-bg overflow-hidden">
            <div
              className="h-full bg-status-amber transition-all duration-300"
              style={{ width: `${(runProgress.current / runProgress.total) * 100}%` }}
            />
          </div>
          {!IS_CANNED && (
            <div className="mt-2 text-[10px] font-mono text-brand-text-dim">
              Live mode — each contract takes ~30-90s on Qwen 7B (CPU). Stay on this page; the batch will continue.
            </div>
          )}
        </div>
      )}

      <label className="block cursor-pointer">
        <input
          type="file"
          accept=".pdf,.docx"
          multiple
          onChange={(e) => onUpload(e.target.files)}
          className="hidden"
          disabled={uploading}
        />
        <div
          className={clsx(
            "border-2 border-dashed p-10 text-center transition-colors",
            uploading
              ? "border-status-amber bg-status-amber/10"
              : "border-brand-border hover:border-brand-accent hover:bg-brand-accent-dim"
          )}
        >
          <Upload className="mx-auto mb-2" size={24} />
          <div className="font-display text-sm uppercase tracking-[1px] text-brand-text-muted">
            {uploading ? "Uploading + embedding…" : "Drop .pdf / .docx or click to upload"}
          </div>
          <div className="text-xs text-brand-text-dim mt-1 font-mono">
            Server extracts text, generates embedding, stores in metabase
          </div>
        </div>
      </label>

      {error && (
        <div className="border border-status-red/60 bg-status-red/10 text-status-red p-3 text-sm font-mono">
          Error: {error}
        </div>
      )}

      <div className="bg-brand-surface border border-brand-border overflow-hidden">
        <div className={clsx("grid gap-2 px-4 py-3 border-b border-brand-border font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim", ROW_GRID)}>
          <span data-no-navigate className="flex items-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              className="cursor-pointer accent-brand-accent"
              title={allSelected ? "Deselect all" : "Select all"}
            />
          </span>
          <span />
          <span>Filename</span>
          <span>Counterparty</span>
          <span>TCV</span>
          <span>Source</span>
          <span>Risk</span>
          <span>Tech Acct</span>
          <span>Status</span>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-brand-text-muted">Loading…</div>
        ) : contracts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-brand-text-muted">
            No contracts yet. Upload one above or run <code className="font-mono">pnpm seed</code> in the server.
          </div>
        ) : (
          contracts.map((c) => {
            const checked = selectedIds.has(c.id);
            const isProcessed = processedIds.has(c.id);
            // R/Y/G row tinting only applies post-processing. Unprocessed rows
            // stay neutral so the controller sees a clean queue before agents
            // reveal the risk picture.
            const rowTint = isProcessed
              ? c.risk_category === "High"
                ? "border-l-4 border-l-status-red bg-status-red/[0.04]"
                : c.risk_category === "Medium"
                  ? "border-l-4 border-l-status-amber bg-status-amber/[0.04]"
                  : c.risk_category === "Low"
                    ? "border-l-4 border-l-status-green bg-status-green/[0.04]"
                    : ""
              : "border-l-4 border-l-transparent";
            return (
              <div
                key={c.id}
                onClick={(e) => goToRow(c.id, e)}
                className={clsx(
                  "grid gap-2 px-4 py-3 items-center border-b border-brand-border hover:bg-brand-accent-dim transition-colors cursor-pointer",
                  ROW_GRID,
                  rowTint,
                  checked && "ring-1 ring-brand-accent/30"
                )}
              >
                <span data-no-navigate className="flex items-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOne(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer accent-brand-accent"
                    title={isProcessed ? "Already processed in this session — re-run will refresh outputs" : "Pending — will run extract → risk → tech-acct"}
                  />
                </span>
                <FileText size={16} className={isProcessed ? "text-brand-text-dim" : "text-brand-text-dim/60"} />
                <span className="text-sm truncate">{c.filename}</span>
                <span className="text-sm text-brand-text-muted truncate">
                  {c.counterparty ?? "—"}
                </span>
                <span className="font-mono text-xs text-brand-text tabular-nums">
                  {c.tcv ?? "—"}
                </span>
                <span className="font-mono text-[10px] uppercase text-brand-text-dim">
                  {c.source.replace("sample_", "")}
                </span>
                <span>
                  {isProcessed && c.risk_category ? (
                    <span
                      className={clsx(
                        "font-display text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border",
                        c.risk_category === "High" &&
                          "text-status-red border-status-red/60 bg-status-red/10",
                        c.risk_category === "Medium" &&
                          "text-status-amber border-status-amber/60 bg-status-amber/10",
                        c.risk_category === "Low" &&
                          "text-status-green border-status-green/60 bg-status-green/10"
                      )}
                    >
                      {c.risk_category}
                      {c.risk_score !== null ? ` · ${c.risk_score}` : ""}
                    </span>
                  ) : (
                    <span className="text-[10px] text-brand-text-dim font-mono italic">unscored</span>
                  )}
                </span>
                <span className="flex flex-wrap gap-1">
                  {isProcessed && c.lease_flagged && (
                    <span className="font-display text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border text-status-amber border-status-amber/60 bg-status-amber/10">
                      Lease
                    </span>
                  )}
                  {isProcessed && c.derivative_flagged && (
                    <span className="font-display text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border text-status-purple border-status-purple/60 bg-status-purple/10">
                      Deriv
                    </span>
                  )}
                  {(!isProcessed || (!c.lease_flagged && !c.derivative_flagged)) && (
                    <span className="text-[10px] text-brand-text-dim font-mono">{isProcessed ? "—" : "pending"}</span>
                  )}
                </span>
                <span className={clsx(
                  "font-mono text-[10px] uppercase",
                  isProcessed ? "text-status-green" : "text-status-amber"
                )}>
                  {isProcessed ? "done" : "pending"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>

    {runResults && <RunResultsModal results={runResults} onClose={() => setRunResults(null)} />}
    {accrualResults && (
      <AccrualResultsModal
        results={accrualResults}
        onSubmitAll={submitAllCalculated}
        onClose={() => setAccrualResults(null)}
      />
    )}
    </OllamaGuard>
  );
}

function endOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}

function RunResultsModal({
  results,
  onClose,
}: {
  results: RunResult[];
  onClose: () => void;
}) {
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // If a review modal is open, close it first; otherwise close the results modal
      if (reviewingId) setReviewingId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, reviewingId]);

  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  // Group OK results by risk so the user sees what to act on first
  const okResults = results.filter((r) => r.status === "ok");
  const high = okResults.filter((r) => r.contract.risk_category === "High");
  const medium = okResults.filter((r) => r.contract.risk_category === "Medium");
  const low = okResults.filter((r) => r.contract.risk_category === "Low");
  const errored = results.filter((r) => r.status === "error");

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-brand-surface border border-brand-accent max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between sticky top-0 bg-brand-surface z-10">
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[3px] text-brand-accent">
              Batch run complete
            </div>
            <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight mt-1">
              Review results — choose next steps
            </h3>
            <p className="text-xs text-brand-text-muted font-mono mt-1">
              {ok} processed · {failed} failed · {high.length} High · {medium.length} Medium · {low.length} Low
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-text-dim hover:text-brand-text"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {high.length > 0 && (
            <ResultGroup title="High risk — review priority" tone="red" items={high} onReview={setReviewingId} />
          )}
          {medium.length > 0 && (
            <ResultGroup title="Medium risk" tone="amber" items={medium} onReview={setReviewingId} />
          )}
          {low.length > 0 && (
            <ResultGroup title="Low risk" tone="green" items={low} onReview={setReviewingId} />
          )}
          {errored.length > 0 && (
            <div className="space-y-2">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-status-red flex items-center gap-1">
                <AlertCircle size={12} /> Failed ({errored.length})
              </div>
              <div className="border border-status-red/30 bg-status-red/5">
                {errored.map((r) => (
                  <div key={r.contract.id} className="px-3 py-2 border-b border-status-red/20 last:border-b-0 text-xs font-mono">
                    <span className="text-brand-text">{r.contract.filename}</span>
                    <span className="text-status-red ml-2">— {r.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-brand-border flex items-center justify-between sticky bottom-0 bg-brand-surface">
          <div className="text-[11px] text-brand-text-dim font-mono">
            Click any row to open the contract detail. High-risk items typically need accrual review.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-brand-accent text-black font-display font-bold uppercase text-[11px] tracking-wider hover:opacity-80 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
      {reviewingId && (
        <ContractReviewModal
          contractId={reviewingId}
          onClose={() => setReviewingId(null)}
        />
      )}
    </div>
  );
}

function ResultGroup({
  title,
  tone,
  items,
  onReview,
}: {
  title: string;
  tone: "red" | "amber" | "green";
  items: RunResult[];
  onReview: (id: string) => void;
}) {
  const toneCls = {
    red: "text-status-red border-status-red/40",
    amber: "text-status-amber border-status-amber/40",
    green: "text-status-green border-status-green/40",
  }[tone];
  return (
    <div className="space-y-2">
      <div className={clsx("font-display text-[10px] font-bold uppercase tracking-[2px] flex items-center gap-1", toneCls)}>
        <CheckCircle2 size={12} /> {title} ({items.length})
      </div>
      <div className={clsx("border", toneCls)}>
        {items.map((r) => {
          const c = r.contract;
          const reasons = (c as ContractSummary & { risk_reasons?: string[] }).risk_reasons ?? [];
          return (
            <div
              key={c.id}
              className="px-4 py-3 border-b border-brand-border last:border-b-0 hover:bg-brand-accent-dim/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-brand-text font-medium truncate">
                      {c.counterparty ?? c.filename}
                    </span>
                    <span className="font-mono text-[10px] text-brand-text-dim">
                      {c.tcv ?? "—"}
                    </span>
                    {c.risk_score !== null && (
                      <span className={clsx("font-display text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border", toneCls)}>
                        {c.risk_category} · {c.risk_score}
                      </span>
                    )}
                    {c.lease_flagged && (
                      <span className="font-display text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border text-status-amber border-status-amber/60 bg-status-amber/10">
                        Lease
                      </span>
                    )}
                    {c.derivative_flagged && (
                      <span className="font-display text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border text-status-purple border-status-purple/60 bg-status-purple/10">
                        Deriv
                      </span>
                    )}
                  </div>
                  {Array.isArray(reasons) && reasons.length > 0 && (
                    <ul className="mt-1 text-[11px] text-brand-text-muted font-mono list-disc list-inside space-y-0.5">
                      {reasons.slice(0, 3).map((reason, idx) => (
                        <li key={idx} className="truncate">{String(reason)}</li>
                      ))}
                      {reasons.length > 3 && (
                        <li className="text-brand-text-dim italic">+ {reasons.length - 3} more reason{reasons.length - 3 === 1 ? "" : "s"}…</li>
                      )}
                    </ul>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onReview(c.id)}
                    className="px-3 py-1.5 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[10px] tracking-wider hover:border-brand-accent hover:text-brand-accent flex items-center gap-1 cursor-pointer"
                  >
                    Review <ArrowRight size={10} />
                  </button>
                  <Link
                    to={`/contracts/${c.id}/accrual`}
                    className="px-3 py-1.5 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[10px] tracking-wider hover:border-brand-accent hover:text-brand-accent flex items-center gap-1"
                  >
                    Accrual <ArrowRight size={10} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContractReviewModal({
  contractId,
  onClose,
}: {
  contractId: string;
  onClose: () => void;
}) {
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getContract(contractId);
        if (!cancelled) setContract(c);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [contractId]);

  const risk: RiskResult | null = contract && contract.risk_score != null && contract.risk_category
    ? {
        score: contract.risk_score,
        category: contract.risk_category as RiskResult["category"],
        reasons: (contract.risk_reasons as string[] | null) ?? [],
      }
    : null;
  const techFlags = (contract?.tech_acct_flags as TechAccountingFlags | null) ?? null;
  const attrs = (contract?.attributes as Record<string, unknown> | null) ?? null;

  // z-110 places this above the run-results modal (z-100) so it stacks correctly
  return (
    <div
      className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-brand-surface border border-brand-accent max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-brand-border flex items-start justify-between sticky top-0 bg-brand-surface z-10">
          <div className="min-w-0">
            <div className="font-display text-[10px] font-bold uppercase tracking-[3px] text-brand-accent">
              Contract Review
            </div>
            <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight mt-1 truncate">
              {contract?.counterparty ?? contract?.filename ?? "Loading…"}
            </h3>
            {contract && (
              <p className="text-xs text-brand-text-muted font-mono mt-1">
                {contract.filename} · {contract.tcv ?? "—"} · uploaded {new Date(contract.uploaded_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-text-dim hover:text-brand-text flex-shrink-0 ml-4"
            aria-label="Close review"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loadError && (
            <div className="border border-status-red/60 bg-status-red/10 text-status-red p-3 text-sm font-mono">
              {loadError}
            </div>
          )}
          {!contract && !loadError && (
            <div className="text-sm text-brand-text-muted italic">Loading contract detail…</div>
          )}
          {contract && (
            <>
              <div className="grid grid-cols-2 gap-[2px]">
                <div className="bg-brand-surface-alt border border-brand-border p-5">
                  <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-3">
                    Risk (UC-08)
                  </div>
                  <RiskPanel risk={risk} />
                </div>
                <div className="bg-brand-surface-alt border border-brand-border p-5">
                  <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-3">
                    Technical Accounting (UC-09)
                  </div>
                  <TechAccountingFlagsPanel flags={techFlags} />
                </div>
              </div>

              <div className="bg-brand-surface-alt border border-brand-border p-5">
                <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-3">
                  27-Attribute Checklist (UC-07)
                </div>
                <AttributeChecklist attributes={attrs} />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-brand-border flex items-center justify-between sticky bottom-0 bg-brand-surface">
          <div className="text-[11px] text-brand-text-dim font-mono">
            Reviewing {contract?.counterparty ?? "contract"}. Close when you're done — you'll be back at the batch results.
          </div>
          <div className="flex gap-2">
            {contract && (
              <Link
                to={`/contracts/${contract.id}/accrual`}
                className="px-4 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent hover:text-brand-accent cursor-pointer"
              >
                Open accrual →
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-brand-accent text-black font-display font-bold uppercase text-[11px] tracking-wider hover:opacity-80 cursor-pointer"
            >
              Done — back to results
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccrualResultsModal({
  results,
  onSubmitAll,
  onClose,
}: {
  results: AccrualResult[];
  onSubmitAll: () => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const calculated = results.filter((r) => r.status === "calculated");
  const submitted = results.filter((r) => r.status === "submitted");
  const autoPosted = results.filter((r) => r.status === "auto-posted");
  const skipped = results.filter((r) => r.status === "skipped");
  const errored = results.filter((r) => r.status === "error");
  const hasCalculated = calculated.length > 0;

  const fmtAmt = (n: number | undefined) =>
    n === undefined
      ? "—"
      : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const calculatedTotal = calculated.reduce((s, r) => s + (r.amount ?? 0), 0);
  const submittedTotal = submitted.reduce((s, r) => s + (r.amount ?? 0), 0);
  const autoTotal = autoPosted.reduce((s, r) => s + (r.amount ?? 0), 0);

  // Group calculated/submitted by tier so the user understands routing
  const calcByTier: Record<string, AccrualResult[]> = {};
  for (const r of calculated) {
    const key = r.tier ?? "unknown";
    (calcByTier[key] ??= []).push(r);
  }
  const submittedByTier: Record<string, AccrualResult[]> = {};
  for (const r of submitted) {
    const key = r.tier ?? "unknown";
    (submittedByTier[key] ??= []).push(r);
  }
  const TIER_ORDER: Array<MaterialityTier | "unknown"> = ["exec", "controller", "manager", "standard", "unknown"];
  const TIER_LABEL: Record<string, string> = {
    exec: "Manager + Director (dual) · > $5M",
    controller: "Manager · $1M–$5M",
    manager: "Senior Accountant · $100K–$1M",
    standard: "Auto-post · < $100K",
    unknown: "Unrouted",
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-brand-surface border border-brand-accent max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between sticky top-0 bg-brand-surface z-10">
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[3px] text-brand-accent">
              {hasCalculated ? "Accruals calculated — review before submitting" : "Accrual batch complete"}
            </div>
            <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight mt-1">
              {results.length} contract{results.length === 1 ? "" : "s"} processed
            </h3>
            <p className="text-xs text-brand-text-muted font-mono mt-1">
              {hasCalculated && `${calculated.length} ready to submit (${fmtAmt(calculatedTotal)})`}
              {hasCalculated && (submitted.length || autoPosted.length || skipped.length || errored.length) ? " · " : ""}
              {submitted.length > 0 && `${submitted.length} submitted (${fmtAmt(submittedTotal)})`}
              {submitted.length > 0 && (autoPosted.length || skipped.length || errored.length) ? " · " : ""}
              {autoPosted.length > 0 && `${autoPosted.length} auto-posted (${fmtAmt(autoTotal)})`}
              {autoPosted.length > 0 && (skipped.length || errored.length) ? " · " : ""}
              {skipped.length > 0 && `${skipped.length} skipped`}
              {skipped.length > 0 && errored.length ? " · " : ""}
              {errored.length > 0 && `${errored.length} failed`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-text-dim hover:text-brand-text"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {hasCalculated && TIER_ORDER.map((tier) => {
            const tierResults = calcByTier[tier];
            if (!tierResults || tierResults.length === 0) return null;
            return (
              <div key={`calc-${tier}`} className="space-y-2">
                <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-status-amber flex items-center gap-1">
                  <Calculator size={12} /> Calculated · will route to {TIER_LABEL[tier]} ({tierResults.length})
                </div>
                <div className="border border-status-amber/40">
                  {tierResults.map((r) => (
                    <AccrualRow key={r.contract.id} r={r} />
                  ))}
                </div>
              </div>
            );
          })}

          {submitted.length > 0 && TIER_ORDER.map((tier) => {
            const tierResults = submittedByTier[tier];
            if (!tierResults || tierResults.length === 0) return null;
            return (
              <div key={`sub-${tier}`} className="space-y-2">
                <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-accent flex items-center gap-1">
                  <CheckCircle2 size={12} /> Submitted to {TIER_LABEL[tier]} ({tierResults.length})
                </div>
                <div className="border border-brand-border">
                  {tierResults.map((r) => (
                    <AccrualRow key={r.contract.id} r={r} />
                  ))}
                </div>
              </div>
            );
          })}

          {autoPosted.length > 0 && (
            <div className="space-y-2">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-status-green flex items-center gap-1">
                <CheckCircle2 size={12} /> Auto-posted to SAP — below $100K materiality ({autoPosted.length})
              </div>
              <div className="border border-status-green/40">
                {autoPosted.map((r) => (
                  <AccrualRow key={r.contract.id} r={r} />
                ))}
              </div>
            </div>
          )}

          {skipped.length > 0 && (
            <div className="space-y-2">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-status-amber flex items-center gap-1">
                <AlertCircle size={12} /> Skipped ({skipped.length})
              </div>
              <div className="border border-status-amber/40">
                {skipped.map((r) => (
                  <div key={r.contract.id} className="px-4 py-3 border-b border-brand-border last:border-b-0 text-xs font-mono">
                    <div className="text-brand-text">
                      {r.contract.counterparty ?? r.contract.filename}
                    </div>
                    <div className="text-status-amber mt-0.5">{r.reason}</div>
                    {r.missing && r.missing.length > 0 && (
                      <ul className="mt-1 list-disc list-inside text-[11px] text-brand-text-muted">
                        {r.missing.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {errored.length > 0 && (
            <div className="space-y-2">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-status-red flex items-center gap-1">
                <AlertCircle size={12} /> Failed ({errored.length})
              </div>
              <div className="border border-status-red/40">
                {errored.map((r) => (
                  <div key={r.contract.id} className="px-4 py-3 border-b border-brand-border last:border-b-0 text-xs font-mono">
                    <span className="text-brand-text">{r.contract.filename}</span>
                    <span className="text-status-red ml-2">— {r.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-brand-border flex items-center justify-between sticky bottom-0 bg-brand-surface">
          <div className="text-[11px] text-brand-text-dim font-mono">
            {hasCalculated
              ? `Click Submit all to send ${calculated.length} JE${calculated.length === 1 ? "" : "s"} to the JE Review Queue. Auto-reversal will process on each entry's reversal date.`
              : "Submitted JEs are waiting in the JE Review Queue. Auto-reversal will process on each entry's reversal date."}
          </div>
          <div className="flex gap-2">
            {!hasCalculated && (submitted.length > 0 || autoPosted.length > 0) && (
              <Link
                to="/review"
                className="px-4 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent hover:text-brand-accent cursor-pointer"
              >
                Open JE Review Queue →
              </Link>
            )}
            {hasCalculated && (
              <button
                type="button"
                onClick={async () => {
                  setSubmitting(true);
                  try { await onSubmitAll(); } finally { setSubmitting(false); }
                }}
                disabled={submitting}
                className="px-4 py-2 bg-brand-accent text-black font-display font-bold uppercase text-[11px] tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                {submitting ? "Submitting…" : `Submit all (${calculated.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={clsx(
                "px-4 py-2 font-display font-bold uppercase text-[11px] tracking-wider cursor-pointer",
                hasCalculated
                  ? "bg-brand-surface-alt border border-brand-border hover:border-brand-text-dim"
                  : "bg-brand-accent text-black hover:opacity-80"
              )}
            >
              {hasCalculated ? "Cancel" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccrualRow({ r }: { r: AccrualResult }) {
  const c = r.contract;
  const fmtAmt = (n: number | undefined) =>
    n === undefined
      ? "—"
      : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return (
    <div className="px-4 py-3 border-b border-brand-border last:border-b-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-brand-text truncate">
            {c.counterparty ?? c.filename}
          </div>
          <div className="text-[11px] text-brand-text-dim font-mono mt-0.5">
            Period {r.period}
            {r.reversalDate && ` · auto-reversal ${r.reversalDate}`}
            {r.postingRef && ` · SAP ${r.postingRef}`}
          </div>
        </div>
        <div className="font-mono text-sm tabular-nums text-brand-text font-semibold flex-shrink-0">
          {fmtAmt(r.amount)}
        </div>
      </div>
    </div>
  );
}
