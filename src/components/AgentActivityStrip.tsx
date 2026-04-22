import clsx from "clsx";
import type { AgentEvent, AgentStep, AgentStatus } from "@/adapters";
import { Check, Loader2, AlertTriangle, Circle } from "lucide-react";

interface Props {
  events: AgentEvent[];
  /** Which steps are visible in the strip (order matters). */
  steps?: AgentStep[];
}

const DEFAULT_STEPS: AgentStep[] = ["extract", "risk", "techAcct", "accrual"];

const LABELS: Record<AgentStep, string> = {
  extract: "Extract",
  risk: "Risk",
  techAcct: "Tech Acct",
  accrual: "Accrual",
  "narrative-variance": "Variance",
  "narrative-exec": "Exec Summary",
};

function statusFor(events: AgentEvent[], step: AgentStep): AgentStatus {
  // Latest event for this step wins
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].step === step) return events[i].status;
  }
  return "idle";
}

function detailFor(events: AgentEvent[], step: AgentStep): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].step === step && events[i].detail) return events[i].detail;
  }
  return undefined;
}

export default function AgentActivityStrip({ events, steps = DEFAULT_STEPS }: Props) {
  return (
    <div className="flex gap-[2px] border border-brand-border bg-brand-surface">
      {steps.map((step, i) => {
        const status = statusFor(events, step);
        const detail = detailFor(events, step);
        return (
          <div
            key={step}
            className={clsx(
              "flex-1 px-3 py-3 flex items-center gap-2 transition-colors relative",
              status === "idle" && "bg-brand-surface-alt text-brand-text-dim",
              status === "start" && "bg-status-amber/10 text-status-amber",
              status === "done" && "bg-status-green/10 text-status-green",
              status === "error" && "bg-status-red/10 text-status-red"
            )}
            title={detail}
          >
            <span className="font-mono text-[10px] text-brand-text-dim">{i + 1}</span>
            <span className="flex-shrink-0">
              {status === "idle" && <Circle size={14} />}
              {status === "start" && <Loader2 size={14} className="animate-spin" />}
              {status === "done" && <Check size={14} />}
              {status === "error" && <AlertTriangle size={14} />}
            </span>
            <span className="font-display text-xs font-bold uppercase tracking-wider truncate">
              {LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
