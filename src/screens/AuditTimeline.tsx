import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { auditEvents, getContract, listJEsForContract, type AuditEvent, type ContractDetail, type ProposedJERecord } from "@/lib/api-client";
import JEStatusBadge from "@/components/JEStatusBadge";
import { ArrowLeft, FileText } from "lucide-react";

const EVENT_ICONS: Record<string, string> = {
  upload:            "📤",
  extract:           "🔍",
  risk:              "⚠️",
  tech_acct:         "📐",
  accrual:           "💵",
  je_submit:         "📨",
  je_approve:        "✅",
  je_reject:         "❌",
  je_post:           "🏦",
  je_reversal:       "↩️",
  approve:           "✅",
  default:           "·",
};

function dt(s: string) {
  return new Date(s).toLocaleString();
}

export default function AuditTimeline() {
  const { contractId } = useParams<{ contractId: string }>();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [jes, setJEs] = useState<ProposedJERecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractId) return;
    Promise.all([
      getContract(contractId),
      auditEvents(contractId, 500),
      listJEsForContract(contractId),
    ])
      .then(([c, e, j]) => { setContract(c); setEvents([...e].reverse()); setJEs(j); })
      .catch((e) => setError(String(e)));
  }, [contractId]);

  if (error) return <div className="text-status-red">Error: {error}</div>;
  if (!contract) return <div className="text-brand-text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <Link
        to={`/contracts/${contractId}`}
        className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider text-brand-text-muted hover:text-brand-accent"
      >
        <ArrowLeft size={12} /> Back to contract
      </Link>

      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
          Audit Timeline
        </h1>
        <div className="text-sm text-brand-text-muted mt-2 font-mono">
          {contract.filename} · SOX traceability · {events.length} events
        </div>
      </div>

      {jes.length > 0 && (
        <div className="bg-brand-surface border border-brand-border">
          <div className="px-4 py-3 border-b border-brand-border font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
            Proposed Journal Entries for this Contract
          </div>
          {jes.map((je) => (
            <div key={je.id} className="px-4 py-3 border-b border-brand-border last:border-b-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={14} className="text-brand-text-dim" />
                  <div>
                    <div className="text-sm text-brand-text font-mono">
                      Period {je.period} · ${parseFloat(je.total_amount).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-brand-text-dim font-mono">
                      Reversal {je.reversal_date}
                      {je.posting_ref && ` · SAP ${je.posting_ref}`}
                      {je.reversal_ref && ` → Reversal SAP ${je.reversal_ref}`}
                    </div>
                  </div>
                </div>
                <JEStatusBadge status={je.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-brand-surface border border-brand-border">
        <div className="px-4 py-3 border-b border-brand-border font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
          Event Chain of Custody (oldest → newest)
        </div>
        <div className="divide-y divide-brand-border">
          {events.length === 0 ? (
            <div className="px-4 py-6 text-sm text-brand-text-muted italic">
              No audit events yet.
            </div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="px-4 py-3 grid grid-cols-[30px_140px_130px_120px_1fr] gap-3 items-start text-xs">
                <div className="text-lg">{EVENT_ICONS[e.event_type] ?? EVENT_ICONS.default}</div>
                <div className="font-mono text-brand-accent font-bold">{e.event_type}</div>
                <div className="font-mono text-brand-text-dim">{e.agent ?? "—"}</div>
                <div className="font-mono text-brand-text-muted">{dt(e.ts)}</div>
                <div className="font-mono text-brand-text-muted leading-relaxed">
                  {e.payload ? JSON.stringify(e.payload, null, 0).slice(0, 180) : ""}
                  {e.user_id && <span className="text-brand-accent"> · by {e.user_id}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
