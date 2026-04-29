import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { seedPnL, topVariancesByDollar, type PnLLine } from "@/data/seed-pnl";
import { agent, type AgentEvent } from "@/adapters";
import type { VarianceCommentary, ExecutiveSummary } from "@/agents/narrative";
import OllamaGuard from "@/components/OllamaGuard";
import AgentActivityStrip from "@/components/AgentActivityStrip";
import VarianceTable from "@/components/VarianceTable";
import CommentaryPanel from "@/components/CommentaryPanel";
import ExecSummaryCard from "@/components/ExecSummaryCard";
import BalanceSheetNarrative from "@/components/BalanceSheetNarrative";
import { useCloseStore } from "@/store/closeStore";
import { useUiStore } from "@/store/uiStore";
import clsx from "clsx";
import { Play, Loader2 } from "lucide-react";

type TabKey = "variance" | "exec" | "balance-sheet";

export default function Narrative() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabKey =
    tabParam === "exec" ? "exec"
    : tabParam === "balance-sheet" ? "balance-sheet"
    : "variance";
  const [tab, setTab] = useState<TabKey>(initialTab);

  // Variance state
  const [selected, setSelected] = useState<PnLLine | null>(seedPnL[0]);
  const [commentaries, setCommentaries] = useState<Record<string, VarianceCommentary>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [variantEvents, setVariantEvents] = useState<AgentEvent[]>([]);

  // Exec state
  const [execSummary, setExecSummary] = useState<ExecutiveSummary | null>(null);
  const [execRunning, setExecRunning] = useState(false);
  const [execEvents, setExecEvents] = useState<AgentEvent[]>([]);

  // Close cockpit state for exec inputs
  const closeDay = useCloseStore((s) => s.day);
  const activePhase = useCloseStore((s) => s.activePhase);

  const anyVarianceRunning = runningIds.size > 0;

  const runCommentary = async (line: PnLLine) => {
    setSelected(line);
    setRunningIds((s) => {
      const next = new Set(s);
      next.add(line.id);
      return next;
    });
    try {
      const result = await agent.generateVarianceCommentary(line, {
        onEvent: (e) => {
          setVariantEvents((prev) => [...prev, e]);
          useUiStore.getState().pushAgentActivity(e, `narrative:variance:${line.id}`);
        },
      });
      setCommentaries((c) => ({ ...c, [line.id]: result }));
    } finally {
      setRunningIds((s) => {
        const next = new Set(s);
        next.delete(line.id);
        return next;
      });
    }
  };

  const runAll = async () => {
    for (const line of seedPnL) {
      if (commentaries[line.id]) continue;
      // eslint-disable-next-line no-await-in-loop
      await runCommentary(line);
    }
  };

  const runExec = async () => {
    setExecRunning(true);
    setExecEvents([]);
    try {
      const inputs = {
        closeDays: closeDay > 0 ? closeDay : 5.2,
        closeTarget: 8,
        autoCertRate: 0.82,
        topVariances: topVariancesByDollar(3),
        risks: [
          "FX translation pressure on APLA exposure",
          "Demand creation spend above plan by $130M",
        ],
        period: "Q2 FY26",
      };
      const r = await agent.generateExecutiveSummary(inputs, {
        onEvent: (e) => {
          setExecEvents((prev) => [...prev, e]);
          useUiStore.getState().pushAgentActivity(e, "narrative:exec");
        },
      });
      setExecSummary(r);
    } finally {
      setExecRunning(false);
    }
  };

  // Auto-run exec when arriving with ?tab=exec&autorun=true
  useEffect(() => {
    const autorun = searchParams.get("autorun") === "true";
    if (initialTab === "exec" && autorun && !execSummary && !execRunning) {
      void runExec();
      // Strip the autorun param so refresh doesn't re-trigger
      searchParams.delete("autorun");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCommentary = useMemo(
    () => (selected ? commentaries[selected.id] ?? null : null),
    [selected, commentaries]
  );
  const selectedRunning = selected ? runningIds.has(selected.id) : false;

  return (
    <OllamaGuard>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
            Narrative
          </h1>
          <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
            UC-18 Variance Commentary + UC-20 Executive Close Narrative. Both grounded in seeded
            P&L data — prompts forbid number fabrication.
          </p>
        </div>

        <div className="flex border-b border-brand-border">
          <TabButton active={tab === "variance"} onClick={() => setTab("variance")}>
            Variance Commentary
          </TabButton>
          <TabButton active={tab === "exec"} onClick={() => setTab("exec")}>
            Executive Summary
          </TabButton>
          <TabButton active={tab === "balance-sheet"} onClick={() => setTab("balance-sheet")}>
            Balance Sheet
          </TabButton>
        </div>

        {tab === "variance" && (
          <div className="space-y-6">
            <AgentActivityStrip events={variantEvents} steps={["narrative-variance"]} />
            <div className="grid grid-cols-[1fr_420px] gap-[2px]">
              <VarianceTable
                commentaries={commentaries}
                runningIds={runningIds}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
                onGenerate={runCommentary}
                onGenerateAll={runAll}
                anyRunning={anyVarianceRunning}
              />
              <CommentaryPanel
                line={selected}
                commentary={selectedCommentary}
                running={selectedRunning}
              />
            </div>
          </div>
        )}

        {tab === "exec" && (
          <div className="space-y-6">
            <AgentActivityStrip events={execEvents} steps={["narrative-exec"]} />

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-brand-text-muted">
                {activePhase
                  ? <>Close metrics: Day {closeDay} · {activePhase.toUpperCase()}</>
                  : <>Close metrics: cockpit idle — using <span className="text-brand-text">5.2-day</span> baseline</>}
              </div>
              <button
                onClick={runExec}
                disabled={execRunning}
                className="px-4 py-2 bg-brand-accent text-black font-display font-bold uppercase text-xs tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {execRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {execRunning ? "Drafting…" : execSummary ? "Re-generate" : "Generate close narrative"}
              </button>
            </div>

            {execSummary ? (
              <ExecSummaryCard summary={execSummary} />
            ) : (
              <div className="bg-brand-surface border border-brand-border p-6 text-sm text-brand-text-muted italic">
                Click Generate to draft an executive close narrative.
              </div>
            )}
          </div>
        )}

        {tab === "balance-sheet" && <BalanceSheetNarrative />}
      </div>
    </OllamaGuard>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-6 py-3 font-display text-sm font-semibold uppercase tracking-[1px] border-b-2 transition-colors",
        active
          ? "text-brand-text border-brand-accent"
          : "text-brand-text-muted border-transparent hover:text-brand-text"
      )}
    >
      {children}
    </button>
  );
}
