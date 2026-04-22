import { Link, useParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { getContract, recordAudit, type ContractDetail } from "@/lib/api-client";
import { agent, type AgentEvent } from "@/adapters";
import { AccrualGapError, type AccrualPipelineResult } from "@/agents/accrual";
import type { ContractAttributes } from "@/agents/contract-schema";
import OllamaGuard from "@/components/OllamaGuard";
import AgentActivityStrip from "@/components/AgentActivityStrip";
import JECard from "@/components/JECard";
import CalcDetailPanel from "@/components/CalcDetailPanel";
import { useCloseStore } from "@/store/closeStore";
import { ArrowLeft, Play, Check, X } from "lucide-react";

export default function AccrualProposal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pushEvent = useCloseStore((s) => s.pushEvent);

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [result, setResult] = useState<AccrualPipelineResult | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [approved, setApproved] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await getContract(id);
      setContract(c);
      // Hydrate prior run from metabase if available
      if (c.proposed_je && typeof c.proposed_je === "object") {
        // We only have the JE snapshot; inputs/calc would need to re-run
      }
    } catch (e) {
      setError(String(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAccrual = async () => {
    if (!contract?.full_text || !id || !contract.attributes) return;
    setRunning(true);
    setError(null);
    setMissing(null);
    setEvents([]);
    const onEvent = (e: AgentEvent) => setEvents((prev) => [...prev, e]);
    try {
      const res = await agent.calculateAccrual(
        id,
        contract.counterparty ?? contract.filename,
        contract.attributes as unknown as ContractAttributes,
        contract.full_text,
        { periodEnd: endOfCurrentMonth(), billedToDate: 0 },
        { onEvent }
      );
      setResult(res);
    } catch (e) {
      if (e instanceof AccrualGapError) {
        setMissing(e.missing);
      } else {
        setError(String(e));
      }
    } finally {
      setRunning(false);
    }
  };

  const approve = async () => {
    if (!result || !id || !contract) return;
    await recordAudit({
      event_type: "approve",
      contract_id: id,
      agent: "accrual",
      payload: {
        je_id: result.je.id,
        amount: result.je.totalDebits,
        period: result.je.period,
      },
    }).catch(() => undefined);
    pushEvent(
      `${contract.filename}: Accrual approved — $${result.je.totalDebits.toLocaleString()} (${result.je.id})`,
      "approval"
    );
    setApproved(true);
    setTimeout(() => navigate(`/contracts/${id}`), 1500);
  };

  if (error && !contract) return <div className="text-status-red">Error: {error}</div>;
  if (!contract) return <div className="text-brand-text-muted">Loading…</div>;

  const attrs = contract.attributes as unknown as ContractAttributes | null;
  const hasAttrs = attrs && typeof attrs === "object" && Object.keys(attrs).length > 0;

  return (
    <OllamaGuard>
      <div className="space-y-6">
        <Link
          to={`/contracts/${id}`}
          className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider text-brand-text-muted hover:text-brand-accent"
        >
          <ArrowLeft size={12} /> Back to contract review
        </Link>

        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
            Accrual Proposal
          </h1>
          <div className="text-sm text-brand-text-muted mt-2">
            {contract.filename} · {contract.counterparty ?? "—"}
          </div>
        </div>

        <AgentActivityStrip events={events} />

        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="text-sm text-brand-text-muted">
            {result
              ? "Accrual computed. Review the JE and approve."
              : hasAttrs
                ? "Attributes available. Run the accrual pipeline."
                : "Run attribute extraction first (ContractReview screen)."}
          </div>
          <button
            onClick={runAccrual}
            disabled={running || !hasAttrs}
            className="px-4 py-2 bg-brand-accent text-black font-display font-bold uppercase text-xs tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Play size={12} />
            {running ? "Computing…" : result ? "Re-compute" : "Compute accrual"}
          </button>
        </div>

        {missing && (
          <div className="border border-status-amber bg-status-amber/10 p-4 space-y-2">
            <div className="font-display text-xs font-bold uppercase tracking-wider text-status-amber">
              Cannot compute — missing inputs
            </div>
            <ul className="text-xs text-brand-text-muted list-disc list-inside font-mono">
              {missing.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
            <Link
              to={`/contracts/${id}`}
              className="inline-block text-xs text-brand-accent hover:underline"
            >
              → Re-run extraction to fill these fields
            </Link>
          </div>
        )}

        {error && (
          <div className="border border-status-red/60 bg-status-red/10 text-status-red p-3 text-sm font-mono">
            Error: {error}
          </div>
        )}

        {result && (
          <div className="grid grid-cols-[1fr_1fr] gap-[2px]">
            <div className="bg-brand-surface border border-brand-border p-5">
              <CalcDetailPanel inputs={result.inputs} calc={result.calc} je={result.je} />
            </div>
            <div className="bg-brand-surface border border-brand-border p-5 space-y-4">
              <JECard je={result.je} />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={approve}
                  disabled={approved}
                  className="flex-1 px-4 py-3 bg-status-green text-black font-display font-bold uppercase text-sm tracking-wider hover:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Check size={14} />
                  {approved ? "Approved" : "Approve & post"}
                </button>
                <button
                  onClick={() => navigate(`/contracts/${id}`)}
                  disabled={approved}
                  className="px-4 py-3 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-sm tracking-wider hover:border-status-red hover:text-status-red disabled:opacity-40 flex items-center gap-2"
                >
                  <X size={14} /> Reject
                </button>
              </div>
              {approved && (
                <div className="text-xs text-status-green font-mono text-center">
                  Audit event written · navigating to Close Cockpit…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </OllamaGuard>
  );
}

function endOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}
