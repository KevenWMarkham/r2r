import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { useCloseStore, type CloseEvent } from "@/store/closeStore";
import { useUiStore, type AgentActivityEntry } from "@/store/uiStore";

// Step → Agent identity (name + color)
const AGENT_BY_STEP: Record<string, { name: string; color: string }> = {
  extract: { name: "ContractAgent", color: "text-status-green" },
  risk: { name: "RiskAgent", color: "text-status-red" },
  techAcct: { name: "TechAcctAgent", color: "text-status-amber" },
  accrual: { name: "AccrualAgent", color: "text-status-purple" },
  "narrative-variance": { name: "ReportingAgent", color: "text-status-cyan" },
  "narrative-exec": { name: "ReportingAgent", color: "text-status-cyan" },
};
const ORCHESTRATOR = { name: "R2R Orchestrator", color: "text-brand-accent" };

const STEP_LABEL: Record<string, string> = {
  extract: "Extract",
  risk: "Risk Score",
  techAcct: "Tech Acct",
  accrual: "Accrual Calc",
  "narrative-variance": "Variance",
  "narrative-exec": "Exec Summary",
};

interface FeedRow {
  ts: number;
  key: string;
  agent: { name: string; color: string };
  statusIcon: string;
  statusColor: string;
  text: string;
  source?: string;
}

function closeEventToRow(e: CloseEvent, idx: number): FeedRow {
  const kind = e.kind ?? "info";
  const statusIcon = kind === "approval" ? "✓" : kind === "agent" ? "●" : "·";
  const statusColor =
    kind === "approval"
      ? "text-status-green"
      : kind === "agent"
      ? "text-brand-accent"
      : "text-brand-text-dim";
  return {
    ts: e.ts,
    key: `c-${e.ts}-${idx}`,
    agent: ORCHESTRATOR,
    statusIcon,
    statusColor,
    text: e.text,
  };
}

function agentEntryToRow(e: AgentActivityEntry, idx: number): FeedRow | null {
  if (e.status === "idle") return null;
  const agent = AGENT_BY_STEP[e.step] ?? { name: e.step, color: "text-brand-text-muted" };
  const stepLabel = STEP_LABEL[e.step] ?? e.step;
  const statusIcon = e.status === "done" ? "✓" : e.status === "error" ? "✗" : "▸";
  const statusColor =
    e.status === "done"
      ? "text-status-green"
      : e.status === "error"
      ? "text-status-red"
      : "text-status-amber";
  const text = e.detail ? `${stepLabel} — ${e.detail}` : stepLabel;
  return {
    ts: e.ts,
    key: `a-${e.ts}-${idx}`,
    agent,
    statusIcon,
    statusColor,
    text,
    source: e.source,
  };
}

export default function LiveConsoleDock() {
  const visible = useUiStore((s) => s.liveConsoleVisible);
  const setVisible = useUiStore((s) => s.setLiveConsoleVisible);
  const agentFeed = useUiStore((s) => s.agentFeed);

  const closeEvents = useCloseStore((s) => s.events);
  const day = useCloseStore((s) => s.day);
  const activePhase = useCloseStore((s) => s.activePhase);
  const closeRunning = useCloseStore((s) => s.running);

  const bodyRef = useRef<HTMLDivElement>(null);

  const rows: FeedRow[] = useMemo(() => {
    const closeRows = closeEvents.map(closeEventToRow);
    const agentRows = agentFeed
      .map(agentEntryToRow)
      .filter((r): r is FeedRow => r !== null);
    return [...closeRows, ...agentRows].sort((a, b) => a.ts - b.ts);
  }, [closeEvents, agentFeed]);

  const agentRunning = useMemo(() => {
    if (agentFeed.length === 0) return false;
    const latestByStep = new Map<string, string>();
    for (const e of agentFeed) latestByStep.set(e.step, e.status);
    return Array.from(latestByStep.values()).some((s) => s === "start");
  }, [agentFeed]);

  const isLive = closeRunning || agentRunning;

  useEffect(() => {
    if (!visible) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length, visible]);

  if (!visible) return null;

  const phaseLabel = activePhase
    ? activePhase.charAt(0).toUpperCase() + activePhase.slice(1)
    : agentRunning
    ? "Agents"
    : "Idle";

  return (
    <div
      className="fixed bottom-6 right-6 w-[560px] h-[300px] bg-black border border-brand-border rounded-md flex flex-col z-50 overflow-hidden"
      style={{
        boxShadow:
          "0 25px 70px rgba(0,0,0,0.7), 0 0 0 1px var(--brand-accent-glow), 0 0 30px var(--brand-accent-dim)",
      }}
      role="dialog"
      aria-label="NOAH live console"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 bg-brand-surface px-3 py-2 border-b border-brand-border flex-shrink-0">
        <div className="flex gap-1.5 flex-shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c941]" />
        </div>
        <div className="flex-1 text-center text-[10px] font-display font-bold tracking-[1.5px] uppercase text-brand-text-muted">
          NOAH · Live Console
        </div>
        <div className="flex items-center gap-1.5 mr-1 flex-shrink-0">
          <span
            className={clsx(
              "w-2 h-2 rounded-full",
              isLive ? "bg-status-green animate-pulse" : "bg-brand-text-dim"
            )}
          />
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-brand-text-muted">
            {isLive ? "LIVE" : "IDLE"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-brand-text-dim hover:text-brand-text transition-colors p-0.5 flex-shrink-0"
          aria-label="Close console"
          title="Close (Ctrl+Shift+L)"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[10.5px] leading-relaxed bg-black/50"
      >
        {rows.length === 0 ? (
          <div className="text-brand-text-dim italic mt-2">
            No activity yet — start the close or run any agent (extract / risk
            / accrual / narrative).
          </div>
        ) : (
          rows.map((r) => {
            const time = new Date(r.ts).toLocaleTimeString();
            return (
              <div key={r.key} className="flex items-baseline gap-2 fade-in">
                <span className="text-brand-text-dim flex-shrink-0 w-[58px]">{time}</span>
                <span
                  className={clsx(
                    "font-bold flex-shrink-0 w-[130px] truncate",
                    r.agent.color
                  )}
                  title={r.agent.name}
                >
                  {r.agent.name}
                </span>
                <span
                  className={clsx("flex-shrink-0 w-[12px] text-center", r.statusColor)}
                >
                  {r.statusIcon}
                </span>
                <span className="text-brand-text-muted flex-1 truncate" title={r.text}>
                  {r.text}
                </span>
                {r.source && (
                  <span className="text-brand-text-dim flex-shrink-0 truncate max-w-[140px]" title={r.source}>
                    {r.source}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="bg-brand-surface px-3 py-1.5 border-t border-brand-border flex justify-between items-center flex-shrink-0 text-[9.5px]">
        <span className="font-mono text-brand-text-dim tracking-wider uppercase">
          Day {day}/6 · {phaseLabel}
        </span>
        <span className="font-mono text-brand-text-dim tracking-wider">
          {rows.length} event{rows.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
