import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listJEQueue,
  approveJE,
  rejectJE,
  runReversals,
  type ProposedJERecord,
} from "@/lib/api-client";
import { subscribeJEStore } from "@/lib/canned-je-store";
import { IS_CANNED } from "@/config/env";
import MaterialityBadge from "@/components/MaterialityBadge";
import { useCloseStore } from "@/store/closeStore";
import { Check, X, RefreshCw, RotateCcw } from "lucide-react";

function fmt(n: string | number) {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function ageInMinutes(submittedAt: string | null): string {
  if (!submittedAt) return "—";
  const ms = Date.now() - new Date(submittedAt).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function ReviewQueue() {
  const [queue, setQueue] = useState<ProposedJERecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const pushEvent = useCloseStore((s) => s.pushEvent);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const q = await listJEQueue();
      setQueue(q);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // In canned mode, subscribe to JE store changes so the queue auto-refreshes
  // when Marcus submits a JE from the AccrualProposal screen on another tab.
  useEffect(() => {
    if (!IS_CANNED) return;
    return subscribeJEStore(() => { void refresh(); });
  }, [refresh]);

  const approve = async (je: ProposedJERecord) => {
    try {
      const updated = await approveJE(je.id, "SG&A Manager");
      pushEvent(
        `${je.filename ?? "JE"}: Approved + posted — ${fmt(je.total_amount)} · SAP ${updated.posting_ref}`,
        "approval"
      );
      await refresh();
    } catch (e) { setError(String(e)); }
  };

  const reject = async (je: ProposedJERecord) => {
    if (!rejectReason.trim()) return;
    try {
      await rejectJE(je.id, rejectReason, "SG&A Manager");
      pushEvent(
        `${je.filename ?? "JE"}: Rejected by SG&A Manager — ${rejectReason}`,
        "info"
      );
      setRejectingId(null);
      setRejectReason("");
      await refresh();
    } catch (e) { setError(String(e)); }
  };

  const fireReversals = async () => {
    const r = await runReversals();
    if (r.count > 0) {
      pushEvent(`${r.count} JE${r.count === 1 ? "" : "s"} auto-reversed at period-end`, "approval");
    } else {
      pushEvent("Reversal batch ran — no posted JEs eligible to reverse", "info");
    }
    await refresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">Review Queue</h1>
          <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
            Journal entries submitted by the Senior Accountant that need SG&A Manager / VP Controlling approval before posting to SAP via BlackLine.
            Below-threshold entries auto-post without human review.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent flex items-center gap-1"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={fireReversals}
            title="Dev-only — simulates SAP auto-reversal batch for JEs whose reversal_date ≤ today"
            className="px-3 py-2 bg-brand-surface-alt border border-status-cyan/40 font-display font-bold uppercase text-[11px] tracking-wider text-status-cyan hover:bg-status-cyan/10 flex items-center gap-1"
          >
            <RotateCcw size={12} /> Fire reversals
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-status-red/60 bg-status-red/10 text-status-red p-3 text-sm font-mono">
          {error}
        </div>
      )}

      <div className="bg-brand-surface border border-brand-border overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_180px_120px_120px_200px] gap-3 px-4 py-3 border-b border-brand-border font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
          <span>Contract</span>
          <span className="text-right">Amount</span>
          <span>Tier</span>
          <span>Submitted</span>
          <span>Prepared By</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-brand-text-muted">Loading…</div>
        ) : queue.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-brand-text-muted">
            Queue is empty. Submit a JE from an <Link to="/contracts" className="text-brand-accent hover:underline">AccrualProposal</Link> to see it here.
          </div>
        ) : (
          queue.map((je) => (
            <div key={je.id} className="border-b border-brand-border last:border-b-0 px-4 py-3">
              <div className="grid grid-cols-[1fr_140px_180px_120px_120px_200px] gap-3 items-center">
                <div>
                  <div className="text-sm text-brand-text truncate">{je.filename}</div>
                  {je.counterparty && (
                    <div className="text-[11px] text-brand-text-muted truncate">{je.counterparty}</div>
                  )}
                  <div className="text-[10px] text-brand-text-dim font-mono mt-0.5">Period {je.period} · Reversal {je.reversal_date}</div>
                </div>
                <div className="font-mono text-right tabular-nums text-brand-text font-semibold">
                  {fmt(je.total_amount)}
                </div>
                <div>
                  <MaterialityBadge tier={je.materiality_tier} />
                </div>
                <div className="text-xs text-brand-text-muted font-mono">
                  {ageInMinutes(je.submitted_at)}
                </div>
                <div className="text-xs text-brand-text-muted">{je.prepared_by}</div>
                <div className="flex gap-1 justify-end">
                  <button
                    onClick={() => approve(je)}
                    className="px-3 py-1.5 bg-status-green text-black font-display font-bold uppercase text-[10px] tracking-wider hover:opacity-80 flex items-center gap-1"
                  >
                    <Check size={10} /> Approve
                  </button>
                  <button
                    onClick={() => { setRejectingId(je.id); setRejectReason(""); }}
                    className="px-3 py-1.5 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[10px] tracking-wider hover:border-status-red hover:text-status-red flex items-center gap-1"
                  >
                    <X size={10} /> Reject
                  </button>
                </div>
              </div>

              {rejectingId === je.id && (
                <div className="mt-3 flex gap-2 items-center bg-brand-surface-alt p-2 border border-status-red/30 fade-in">
                  <input
                    autoFocus
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && reject(je)}
                    placeholder="Rejection reason (required)"
                    className="flex-1 bg-brand-bg border border-brand-border text-brand-text px-3 py-1.5 text-xs focus:outline-none focus:border-status-red font-body"
                  />
                  <button
                    onClick={() => reject(je)}
                    disabled={!rejectReason.trim()}
                    className="px-3 py-1.5 bg-status-red text-black font-display font-bold uppercase text-[10px] tracking-wider hover:opacity-80 disabled:opacity-30"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => { setRejectingId(null); setRejectReason(""); }}
                    className="px-3 py-1.5 border border-brand-border font-display font-bold uppercase text-[10px] tracking-wider hover:border-brand-text-dim"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-brand-text-dim font-mono leading-relaxed">
        Materiality routing: &lt;$100K auto-approve · $100K–$1M → SG&A Manager · $1M–$10M → VP Controlling · &gt;$10M → CFO.
        Approving fires the Posting Agent which calls BlackLine → SAP <code>BAPI_ACC_DOCUMENT_POST</code>.
      </div>
    </div>
  );
}
