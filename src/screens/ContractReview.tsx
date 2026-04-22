import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { getContract, blobUrl, type ContractDetail } from "@/lib/api-client";
import { agent, type AgentEvent } from "@/adapters";
import AgentActivityStrip from "@/components/AgentActivityStrip";
import AttributeChecklist from "@/components/AttributeChecklist";
import RiskPanel from "@/components/RiskPanel";
import TechAccountingFlagsPanel from "@/components/TechAccountingFlags";
import OllamaGuard from "@/components/OllamaGuard";
import type { ContractAttributes } from "@/agents/contract-schema";
import type { RiskResult } from "@/agents/risk";
import type { TechAccountingFlags } from "@/agents/tech-accounting";
import { ArrowLeft, FileText, Play } from "lucide-react";

export default function ContractReview() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await getContract(id);
      setContract(c);
    } catch (e) {
      setError(String(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runFullChain = async () => {
    if (!contract?.full_text || !id) return;
    setRunning(true);
    setEvents([]);
    setError(null);
    const onEvent = (e: AgentEvent) => setEvents((prev) => [...prev, e]);
    try {
      const { attributes } = await agent.extractAttributes(id, contract.full_text, { onEvent });
      await agent.scoreRisk(id, attributes, contract.full_text, { onEvent });
      await agent.flagTechnicalAccounting(id, attributes, contract.full_text, { onEvent });
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const runSingle = async (
    step: "extract" | "risk" | "techAcct",
    opts: { attrs?: ContractAttributes }
  ) => {
    if (!contract?.full_text || !id) return;
    setRunning(true);
    setError(null);
    const onEvent = (e: AgentEvent) => setEvents((prev) => [...prev, e]);
    try {
      if (step === "extract") {
        await agent.extractAttributes(id, contract.full_text, { onEvent });
      } else if (step === "risk" && opts.attrs) {
        await agent.scoreRisk(id, opts.attrs, contract.full_text, { onEvent });
      } else if (step === "techAcct" && opts.attrs) {
        await agent.flagTechnicalAccounting(id, opts.attrs, contract.full_text, { onEvent });
      }
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  if (error && !contract) return <div className="text-status-red">Error: {error}</div>;
  if (!contract) return <div className="text-brand-text-muted">Loading…</div>;

  const hasAttrs =
    contract.attributes &&
    typeof contract.attributes === "object" &&
    Object.keys(contract.attributes).length > 0;
  const attrs = hasAttrs ? (contract.attributes as unknown as ContractAttributes) : null;
  const risk: RiskResult | null =
    contract.risk_score != null && contract.risk_category
      ? {
          score: contract.risk_score,
          category: contract.risk_category as RiskResult["category"],
          reasons: (contract.risk_reasons as string[] | null) ?? [],
        }
      : null;
  const techFlags = (contract.tech_acct_flags as TechAccountingFlags | null) ?? null;

  return (
    <OllamaGuard>
      <div className="space-y-6">
        <Link
          to="/contracts"
          className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider text-brand-text-muted hover:text-brand-accent"
        >
          <ArrowLeft size={12} /> Back to queue
        </Link>

        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
            {contract.filename}
          </h1>
          <div className="text-sm text-brand-text-muted mt-2 font-mono">
            {contract.file_type.toUpperCase()} · {Number(contract.byte_size).toLocaleString()} bytes ·{" "}
            uploaded {new Date(contract.uploaded_at).toLocaleString()}
          </div>
        </div>

        <AgentActivityStrip events={events} />

        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="text-sm text-brand-text-muted">
            {hasAttrs ? "Attributes extracted. Run downstream agents next." : "No attributes yet. Run the extractor first."}
          </div>
          <div className="flex gap-2">
            <button
              onClick={runFullChain}
              disabled={running || !contract.full_text}
              className="px-4 py-2 bg-brand-accent text-black font-display font-bold uppercase text-xs tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play size={12} />
              {running ? "Running…" : "Run full chain"}
            </button>
            {hasAttrs && !running && attrs && (
              <>
                <button
                  onClick={() => runSingle("risk", { attrs })}
                  className="px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-xs tracking-wider hover:border-brand-accent hover:text-brand-accent"
                >
                  Risk only
                </button>
                <button
                  onClick={() => runSingle("techAcct", { attrs })}
                  className="px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-xs tracking-wider hover:border-brand-accent hover:text-brand-accent"
                >
                  Tech-Acct only
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="border border-status-red/60 bg-status-red/10 text-status-red p-3 text-sm font-mono">
            Error: {error}
          </div>
        )}

        <div className="grid grid-cols-[1fr_1fr] gap-[2px]">
          <div className="bg-brand-surface border border-brand-border p-5">
            <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2 flex items-center justify-between">
              <span>Document</span>
              <a
                href={blobUrl(contract.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand-accent hover:underline normal-case"
              >
                <FileText size={12} /> Open original
              </a>
            </div>
            {contract.full_text && (
              <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-brand-text-muted bg-black/40 border border-brand-border p-3 leading-relaxed">
                {contract.full_text.slice(0, 6000)}
                {contract.full_text.length > 6000 ? "\n\n…(truncated)" : ""}
              </div>
            )}
          </div>

          <div className="bg-brand-surface border border-brand-border p-5 space-y-6">
            <div>
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-3">
                Risk (UC-08)
              </div>
              <RiskPanel risk={risk} />
            </div>
            <div className="pt-4 border-t border-brand-border">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-3">
                Technical Accounting (UC-09)
              </div>
              <TechAccountingFlagsPanel flags={techFlags} />
            </div>
          </div>
        </div>

        <div className="bg-brand-surface border border-brand-border p-5">
          <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-3">
            27-Attribute Checklist (UC-07)
          </div>
          <AttributeChecklist attributes={attrs as unknown as Record<string, unknown> | null} />
        </div>
      </div>
    </OllamaGuard>
  );
}
