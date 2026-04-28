import { useCloseStore, type Phase } from "@/store/closeStore";
import clsx from "clsx";

interface PhaseMeta {
  key: Phase;
  label: string;
  num: number;
  days: string;
  desc: string;
  color: string;
}

const phases: PhaseMeta[] = [
  {
    key: "preclose",
    label: "Pre-Close",
    num: 1,
    days: "Day 1-2",
    desc: "Scan SAP for open items. Foundry predicts at-risk accounts. Readiness report via Teams.",
    color: "var(--brand-accent)",
  },
  {
    key: "execute",
    label: "Execute",
    num: 2,
    days: "Day 2-4",
    desc: "BlackLine Smart Close triggers SAP jobs. Event Grid monitoring. Exceptions routed.",
    color: "var(--status-amber)",
  },
  {
    key: "validate",
    label: "Validate",
    num: 3,
    days: "Day 4-5",
    desc: "Balance validation. Recon agent checks. NOAH generates narrative.",
    color: "var(--status-green)",
  },
  {
    key: "gate",
    label: "Gate",
    num: 4,
    days: "Day 5-6",
    desc: "Exceptions below materiality. Controller sign-off. Consolidation signaled.",
    color: "var(--status-purple)",
  },
];

export default function PhaseGrid() {
  const active = useCloseStore((s) => s.activePhase);
  const completed = useCloseStore((s) => s.completedPhases);
  return (
    <div className="grid grid-cols-4 gap-[2px]">
      {phases.map((p) => {
        const isActive = active === p.key;
        const isDone = completed.includes(p.key);
        return (
          <div
            key={p.key}
            className={clsx(
              "p-4 border bg-brand-surface-alt transition-all duration-500 min-w-0 overflow-hidden",
              isActive && "border-brand-accent shadow-[0_0_12px_var(--brand-accent-glow)]",
              isDone && !isActive && "border-status-green/70 bg-status-green/10",
              !isActive && !isDone && "border-brand-border"
            )}
            style={isActive ? { backgroundColor: "var(--brand-accent-dim)" } : undefined}
          >
            <div
              className="font-display text-[9px] font-bold tracking-[2px] uppercase mb-1"
              style={{ color: p.color }}
            >
              Phase {p.num}
            </div>
            <div className="font-display text-sm font-bold uppercase mb-0.5">
              {p.label}
            </div>
            <div className="font-mono text-[10px] text-brand-text-dim mb-2">
              {p.days}
            </div>
            <div className="text-[11px] text-brand-text-muted leading-tight line-clamp-3">
              {p.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}
