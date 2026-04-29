import { Link, useParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { getContract, submitJE, type ContractDetail, type ProposedJERecord } from "@/lib/api-client";
import { agent, type AgentEvent, type AgentStep } from "@/adapters";
import { AccrualGapError, type AccrualPipelineResult } from "@/agents/accrual";
import type { ContractAttributes } from "@/agents/contract-schema";
import OllamaGuard from "@/components/OllamaGuard";
import AgentActivityStrip from "@/components/AgentActivityStrip";
import JECard from "@/components/JECard";
import CalcDetailPanel from "@/components/CalcDetailPanel";
import JEStatusBadge from "@/components/JEStatusBadge";
import MaterialityBadge from "@/components/MaterialityBadge";
import { useCloseStore } from "@/store/closeStore";
import { useUiStore } from "@/store/uiStore";
import { ArrowLeft, Play, Send } from "lucide-react";

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
  const [submitted, setSubmitted] = useState<ProposedJERecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await getContract(id);
      setContract(c);
      // Reflect prior agent runs (extract/risk/techAcct) so the step strip
      // doesn't appear empty after navigating from the contract review screen.
      setEvents(synthEventsFromStatus(c.agent_status));
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
    setEvents((prev) => prev.filter((e) => e.step !== "accrual"));
    const onEvent = (e: AgentEvent) => {
      setEvents((prev) => [...prev, e]);
      useUiStore.getState().pushAgentActivity(e, `accrual:${id}`);
    };
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

  const submit = async () => {
    if (!result || !id || !contract) return;
    setSubmitting(true);
    setError(null);
    try {
      const record = await submitJE({
        contract_id: id,
        period: result.je.period,
        je_body: result.je as unknown as Record<string, unknown>,
        total_amount: result.je.totalDebits,
        reversal_date: result.je.reversalDate,
        prepared_by: "Senior Accountant",
      });
      setSubmitted(record);

      // Route to cockpit event log
      const status = record.status;
      if (status === "posted") {
        pushEvent(
          `${contract.filename}: Auto-approved + posted — $${result.je.totalDebits.toLocaleString()} · SAP ${record.posting_ref}`,
          "approval"
        );
      } else {
        pushEvent(
          `${contract.filename}: JE submitted for review — $${result.je.totalDebits.toLocaleString()} · ${record.materiality_tier} tier`,
          "info"
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
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

              {!submitted ? (
                <div className="pt-2 space-y-2">
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-brand-accent text-black font-display font-bold uppercase text-sm tracking-wider hover:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <Send size={14} />
                    {submitting ? "Submitting…" : "Submit for Review"}
                  </button>
                  <div className="text-[11px] text-brand-text-dim text-center font-mono">
                    Routes to review queue by materiality · under $100K auto-approves
                  </div>
                </div>
              ) : (
                <div className="pt-2 space-y-3 fade-in">
                  <div className="flex items-center justify-between">
                    <JEStatusBadge status={submitted.status} />
                    <MaterialityBadge tier={submitted.materiality_tier} />
                  </div>
                  {submitted.status === "posted" ? (
                    <div className="border border-brand-accent/60 bg-brand-accent-dim p-3 text-xs font-mono">
                      <div className="text-brand-accent font-bold mb-1">AUTO-APPROVED + POSTED</div>
                      <div className="text-brand-text">SAP doc: {submitted.posting_ref}</div>
                      <div className="text-brand-text-muted">Posted at {new Date(submitted.posted_at!).toLocaleString()}</div>
                    </div>
                  ) : submitted.status === "submitted" ? (
                    <div className="border border-status-amber/60 bg-status-amber/10 p-3 text-xs">
                      <div className="text-status-amber font-bold mb-1">AWAITING REVIEWER APPROVAL</div>
                      <div className="text-brand-text-muted">
                        Routed to the {submitted.materiality_tier} tier reviewer.
                        Open the <Link to="/review" className="text-brand-accent hover:underline">Review Queue</Link> to approve.
                      </div>
                    </div>
                  ) : null}
                  <button
                    onClick={() => navigate(`/contracts/${id}`)}
                    className="w-full px-4 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-xs tracking-wider hover:border-brand-accent"
                  >
                    Back to contract
                  </button>
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

function synthEventsFromStatus(status: Record<string, string> | null | undefined): AgentEvent[] {
  if (!status) return [];
  const steps: AgentStep[] = ["extract", "risk", "techAcct"];
  const out: AgentEvent[] = [];
  for (const step of steps) {
    const s = status[step];
    if (s === "done") out.push({ step, status: "done" });
    else if (s === "partial") out.push({ step, status: "done", detail: "Partial extraction" });
    else if (s === "error") out.push({ step, status: "error" });
  }
  return out;
}
