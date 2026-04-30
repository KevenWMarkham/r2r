import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listAllJEs,
  approveJE,
  rejectJE,
  runReversals,
  type ProposedJERecord,
} from "@/lib/api-client";
import { subscribeJEStore } from "@/lib/canned-je-store";
import { IS_CANNED } from "@/config/env";
import MaterialityBadge from "@/components/MaterialityBadge";
import JEStatusBadge from "@/components/JEStatusBadge";
import { useCloseStore } from "@/store/closeStore";
import { Check, X, RefreshCw, ChevronDown, ChevronRight, Download, FastForward } from "lucide-react";
import clsx from "clsx";

// SAP company code — Nike US legal entity. Static placeholder for the demo.
const COMPANY_CODE = "1000";

interface JELine {
  account: string;
  accountName?: string;
  debit?: number;
  credit?: number;
}
interface JEBody {
  id?: string;
  description?: string;
  lines?: JELine[];
  totalDebits?: number;
  totalCredits?: number;
  reversalDate?: string | null;
  supportingCalc?: string;
}

function fmt(n: string | number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return "—";
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

function getJEBody(je: ProposedJERecord): JEBody {
  return (je.je_body ?? {}) as JEBody;
}

function debitLine(body: JEBody): JELine | undefined {
  return body.lines?.find((l) => (l.debit ?? 0) > 0);
}
function creditLine(body: JEBody): JELine | undefined {
  return body.lines?.find((l) => (l.credit ?? 0) > 0);
}

function downloadCalcFile(je: ProposedJERecord): void {
  const body = getJEBody(je);
  const lines: string[] = [];
  lines.push("NOAH — Journal Entry Calculation Worksheet");
  lines.push("=".repeat(60));
  lines.push(`JE ID:           ${je.id}`);
  lines.push(`Contract:        ${je.filename ?? je.contract_id}`);
  lines.push(`Counterparty:    ${je.counterparty ?? "—"}`);
  lines.push(`Period:          ${je.period}`);
  lines.push(`Company Code:    ${COMPANY_CODE}`);
  lines.push(`Materiality:     ${je.materiality_tier ?? "—"}`);
  lines.push(`Status:          ${je.status}`);
  lines.push(`Prepared By:     ${je.prepared_by}`);
  lines.push(`Submitted:       ${je.submitted_at ?? "—"}`);
  if (je.approved_by) lines.push(`Approved By:     ${je.approved_by} at ${je.approved_at ?? "—"}`);
  if (je.posting_ref)  lines.push(`SAP Doc (post):  ${je.posting_ref}`);
  if (je.reversal_ref) lines.push(`SAP Doc (rev):   ${je.reversal_ref}  (reversal date ${je.reversal_date})`);
  lines.push("");
  lines.push(`Description:     ${body.description ?? "—"}`);
  lines.push("");
  lines.push("Journal Lines");
  lines.push("-".repeat(60));
  lines.push(["Cmpy", "Account", "Account Name", "Debit", "Credit"].join("\t"));
  for (const ln of body.lines ?? []) {
    lines.push(
      [
        COMPANY_CODE,
        ln.account,
        ln.accountName ?? "",
        (ln.debit ?? 0) > 0 ? fmt(ln.debit) : "",
        (ln.credit ?? 0) > 0 ? fmt(ln.credit) : "",
      ].join("\t")
    );
  }
  lines.push("-".repeat(60));
  lines.push(`Totals: Debits ${fmt(body.totalDebits)} · Credits ${fmt(body.totalCredits)}`);
  lines.push("");
  lines.push("Calculation Detail");
  lines.push("-".repeat(60));
  lines.push(body.supportingCalc ?? "(no calculation narrative provided)");
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${je.id}_calc.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const COL_GRID = "grid-cols-[24px_1fr_80px_140px_120px_140px_120px_160px_180px]";

function HeaderRow() {
  return (
    <div
      className={clsx(
        "grid gap-3 px-4 py-3 border-b border-brand-border font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim",
        COL_GRID
      )}
    >
      <span />
      <span>Contract</span>
      <span>Cmpy</span>
      <span>Debit Acct</span>
      <span className="text-right">Debit</span>
      <span>Credit Acct</span>
      <span className="text-right">Credit</span>
      <span>Tier · Status</span>
      <span className="text-right">Action</span>
    </div>
  );
}

function JERow({
  je,
  expanded,
  onToggle,
  onApprove,
  onReject,
}: {
  je: ProposedJERecord;
  expanded: boolean;
  onToggle: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const body = getJEBody(je);
  const dr = debitLine(body);
  const cr = creditLine(body);
  const isPending = je.status === "submitted";
  return (
    <div className="border-b border-brand-border last:border-b-0">
      <div className={clsx("grid gap-3 px-4 py-3 items-center", COL_GRID)}>
        <button
          onClick={onToggle}
          className="text-brand-text-dim hover:text-brand-accent flex items-center justify-center"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="min-w-0">
          <div className="text-sm text-brand-text truncate">{je.filename}</div>
          {je.counterparty && (
            <div className="text-[11px] text-brand-text-muted truncate">{je.counterparty}</div>
          )}
          <div className="text-[10px] text-brand-text-dim font-mono mt-0.5">
            Period {je.period}
            {je.reversal_date && ` · Reversal ${je.reversal_date}`}
            {" · "}
            {ageInMinutes(je.submitted_at)}
          </div>
        </div>
        <div className="font-mono text-xs text-brand-text-muted">{COMPANY_CODE}</div>
        <div className="font-mono text-xs text-brand-text">
          {dr ? (
            <>
              <div>{dr.account}</div>
              <div className="text-[10px] text-brand-text-dim truncate">{dr.accountName}</div>
            </>
          ) : (
            "—"
          )}
        </div>
        <div className="font-mono text-right tabular-nums text-brand-text font-semibold">
          {dr ? fmt(dr.debit) : "—"}
        </div>
        <div className="font-mono text-xs text-brand-text">
          {cr ? (
            <>
              <div>{cr.account}</div>
              <div className="text-[10px] text-brand-text-dim truncate">{cr.accountName}</div>
            </>
          ) : (
            "—"
          )}
        </div>
        <div className="font-mono text-right tabular-nums text-brand-text font-semibold">
          {cr ? fmt(cr.credit) : "—"}
        </div>
        <div className="flex flex-col gap-1 items-start">
          <MaterialityBadge tier={je.materiality_tier} />
          <JEStatusBadge status={je.status} />
        </div>
        <div className="flex gap-1 justify-end">
          {isPending && onApprove && onReject ? (
            <>
              <button
                onClick={onApprove}
                className="px-3 py-1.5 bg-status-green text-black font-display font-bold uppercase text-[10px] tracking-wider hover:opacity-80 flex items-center gap-1"
              >
                <Check size={10} /> Approve
              </button>
              <button
                onClick={onReject}
                className="px-3 py-1.5 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[10px] tracking-wider hover:border-status-red hover:text-status-red flex items-center gap-1"
              >
                <X size={10} /> Reject
              </button>
            </>
          ) : (
            <span className="text-[10px] text-brand-text-dim font-mono uppercase tracking-wider">
              No action
            </span>
          )}
        </div>
      </div>
      {expanded && <ExpandedDetail je={je} />}
    </div>
  );
}

function ExpandedDetail({ je }: { je: ProposedJERecord }) {
  const body = getJEBody(je);
  const lines = body.lines ?? [];
  const balanced =
    Math.abs((body.totalDebits ?? 0) - (body.totalCredits ?? 0)) < 0.01;
  return (
    <div className="px-4 pb-4 pt-2 bg-brand-surface-alt/40 fade-in space-y-4">
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <div className="bg-brand-surface border border-brand-border">
          <div className="px-3 py-2 border-b border-brand-border font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
            Full Journal Entry — {body.description ?? "—"}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="font-display text-[9px] font-bold uppercase tracking-[2px] text-brand-text-dim">
                <th className="text-left px-3 py-1.5">Cmpy</th>
                <th className="text-left px-3 py-1.5">Account</th>
                <th className="text-left px-3 py-1.5">Name</th>
                <th className="text-right px-3 py-1.5">Debit</th>
                <th className="text-right px-3 py-1.5">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, i) => (
                <tr key={i} className="border-t border-brand-border">
                  <td className="px-3 py-1.5 font-mono text-brand-text-muted">{COMPANY_CODE}</td>
                  <td className="px-3 py-1.5 font-mono text-brand-text">{ln.account}</td>
                  <td className="px-3 py-1.5 text-brand-text-muted">{ln.accountName}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {(ln.debit ?? 0) > 0 ? fmt(ln.debit) : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {(ln.credit ?? 0) > 0 ? fmt(ln.credit) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                className={clsx(
                  "border-t-2 font-bold",
                  balanced ? "border-status-green" : "border-status-red"
                )}
              >
                <td className="px-3 py-1.5" colSpan={3}>
                  Totals
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {fmt(body.totalDebits)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {fmt(body.totalCredits)}
                </td>
              </tr>
            </tfoot>
          </table>
          {!balanced && (
            <div className="px-3 py-2 bg-status-red/10 text-status-red text-xs font-mono border-t border-status-red/60">
              WARNING: debits ≠ credits
            </div>
          )}
        </div>

        <div className="bg-brand-surface border border-brand-border p-3 space-y-2">
          <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
            Lifecycle
          </div>
          <div className="text-[11px] font-mono space-y-1">
            <div>
              <span className="text-brand-text-dim">Submitted:</span>{" "}
              <span className="text-brand-text">{je.submitted_at ?? "—"}</span>
            </div>
            <div>
              <span className="text-brand-text-dim">Approved:</span>{" "}
              <span className="text-brand-text">
                {je.approved_by ? `${je.approved_by} · ${je.approved_at}` : "—"}
              </span>
            </div>
            <div>
              <span className="text-brand-text-dim">Posted:</span>{" "}
              <span className="text-brand-text">
                {je.posting_ref ? `SAP ${je.posting_ref} · ${je.posted_at}` : "—"}
              </span>
            </div>
            <div>
              <span className="text-brand-text-dim">Reversal:</span>{" "}
              <span className="text-brand-text">
                {je.reversal_ref
                  ? `SAP ${je.reversal_ref} · effective ${je.reversal_date} (auto)`
                  : je.reversal_date
                    ? `Scheduled ${je.reversal_date}`
                    : "n/a"}
              </span>
            </div>
            {je.rejected_reason && (
              <div>
                <span className="text-brand-text-dim">Rejected:</span>{" "}
                <span className="text-status-red">
                  {je.rejected_by} — {je.rejected_reason}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-brand-surface border border-brand-border">
        <div className="px-3 py-2 border-b border-brand-border flex items-center justify-between">
          <span className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
            How this amount was calculated
          </span>
          <button
            onClick={() => downloadCalcFile(je)}
            className="px-2 py-1 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[10px] tracking-wider hover:border-brand-accent hover:text-brand-accent flex items-center gap-1"
          >
            <Download size={10} /> Download
          </button>
        </div>
        <div className="px-3 py-3 text-xs font-mono whitespace-pre-wrap text-brand-text-muted leading-relaxed">
          {body.supportingCalc ?? "(no calculation narrative provided for this JE)"}
        </div>
      </div>
    </div>
  );
}

export default function ReviewQueue() {
  const [allJEs, setAllJEs] = useState<ProposedJERecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const pushEvent = useCloseStore((s) => s.pushEvent);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Sweep due reversals first — posted JEs whose reversal_date has arrived
      // flip to "reversed" automatically under the original approval. Mirrors
      // the SAP F.81 / BlackLine batch policy.
      await runReversals(false);
      const q = await listAllJEs();
      setAllJEs(q);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const advanceClock = async () => {
    try {
      const r = await runReversals(true);
      const msg = r.count > 0
        ? `Demo clock advanced — ${r.count} JE${r.count === 1 ? "" : "s"} auto-reversed under original approval.`
        : "No posted JEs with a scheduled reversal_date to advance. (Construction CIP and prepaid amortizations don't reverse.)";
      setFlash(msg);
      pushEvent(msg, r.count > 0 ? "approval" : "info");
      window.setTimeout(() => setFlash(null), 6000);
      await refresh();
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!IS_CANNED) return;
    return subscribeJEStore(() => { void refresh(); });
  }, [refresh]);

  const { pending, history } = useMemo(() => {
    const p: ProposedJERecord[] = [];
    const h: ProposedJERecord[] = [];
    for (const je of allJEs) {
      if (je.status === "submitted") p.push(je);
      else h.push(je);
    }
    return { pending: p, history: h };
  }, [allJEs]);

  const approve = async (je: ProposedJERecord) => {
    try {
      const updated = await approveJE(je.id, "Manager");
      const note = updated.reversal_date
        ? `${je.filename ?? "JE"}: Approved + posted ${fmt(je.total_amount)} · SAP ${updated.posting_ref} · auto-reversal scheduled ${updated.reversal_date}`
        : `${je.filename ?? "JE"}: Approved + posted ${fmt(je.total_amount)} · SAP ${updated.posting_ref}`;
      pushEvent(note, "approval");
      await refresh();
    } catch (e) { setError(String(e)); }
  };

  const reject = async (je: ProposedJERecord) => {
    if (!rejectReason.trim()) return;
    try {
      await rejectJE(je.id, rejectReason, "Manager");
      pushEvent(`${je.filename ?? "JE"}: Rejected by Manager — ${rejectReason}`, "info");
      setRejectingId(null);
      setRejectReason("");
      await refresh();
    } catch (e) { setError(String(e)); }
  };

  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">JE Review Queue</h1>
          <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
            Journal entries submitted by the Senior Accountant that need Manager (or Manager + Director) approval before posting to SAP via BlackLine.
            Below-threshold entries auto-post; reversals post automatically on their reversal date — approval is inherited from the original entry.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 relative z-10">
          <button
            type="button"
            onClick={() => { void advanceClock(); }}
            title="Demo only — fast-forwards the calendar so any posted JE with a future reversal_date flips to Reversed. In production this happens automatically on the reversal date."
            className="px-3 py-2 bg-brand-surface-alt border border-status-cyan/40 font-display font-bold uppercase text-[11px] tracking-wider text-status-cyan hover:bg-status-cyan/10 flex items-center gap-1 cursor-pointer"
          >
            <FastForward size={12} /> (Demo) advance clock
          </button>
          <button
            type="button"
            onClick={() => { void refresh(); }}
            className="px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : undefined} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-status-red/60 bg-status-red/10 text-status-red p-3 text-sm font-mono">
          {error}
        </div>
      )}

      {flash && (
        <div className="border border-status-cyan/60 bg-status-cyan/10 text-status-cyan p-3 text-sm font-mono fade-in">
          {flash}
        </div>
      )}

      <section className="space-y-3">
        <div className="font-display text-xs font-bold uppercase tracking-[2px] text-brand-text-dim">
          Pending review ({pending.length})
        </div>
        <div className="bg-brand-surface border border-brand-border overflow-hidden">
          <HeaderRow />
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-brand-text-muted">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-brand-text-muted">
              Queue is empty. Submit a JE from an{" "}
              <Link to="/contracts" className="text-brand-accent hover:underline">AccrualProposal</Link> to see it here.
            </div>
          ) : (
            pending.map((je) => (
              <div key={je.id}>
                <JERow
                  je={je}
                  expanded={expandedId === je.id}
                  onToggle={() => toggle(je.id)}
                  onApprove={() => approve(je)}
                  onReject={() => { setRejectingId(je.id); setRejectReason(""); }}
                />
                {rejectingId === je.id && (
                  <div className="px-4 pb-3 -mt-1">
                    <div className="flex gap-2 items-center bg-brand-surface-alt p-2 border border-status-red/30 fade-in">
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
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="font-display text-xs font-bold uppercase tracking-[2px] text-brand-text-dim">
          Recent activity ({history.length})
        </div>
        <div className="bg-brand-surface border border-brand-border overflow-hidden">
          <HeaderRow />
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-brand-text-muted">
              No prior activity yet.
            </div>
          ) : (
            history.map((je) => (
              <JERow
                key={je.id}
                je={je}
                expanded={expandedId === je.id}
                onToggle={() => toggle(je.id)}
              />
            ))
          )}
        </div>
      </section>

      <div className="text-xs text-brand-text-dim font-mono leading-relaxed">
        Materiality routing: &lt;$100K auto-post · $100K–$1M → Senior Accountant · $1M–$5M → Manager · &gt;$5M → Manager + Director (dual approval).
        Approving fires the Posting Agent which calls BlackLine → SAP <code>BAPI_ACC_DOCUMENT_POST</code>.
        Reversals are auto-processed under the original approval — no separate sign-off required.
      </div>
    </div>
  );
}
