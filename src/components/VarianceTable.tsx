import { seedPnL, type PnLLine } from "@/data/seed-pnl";
import clsx from "clsx";
import { Play } from "lucide-react";

interface Props {
  commentaries: Record<string, { confidence: number } | undefined>;
  runningIds: Set<string>;
  selectedId: string | null;
  onSelect: (line: PnLLine) => void;
  onGenerate: (line: PnLLine) => void;
  onGenerateAll: () => void;
  anyRunning: boolean;
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pctColor(pct: number): string {
  if (pct >= 2) return "text-status-green";
  if (pct <= -2) return "text-status-red";
  return "text-brand-text-muted";
}

export default function VarianceTable({
  commentaries,
  runningIds,
  selectedId,
  onSelect,
  onGenerate,
  onGenerateAll,
  anyRunning,
}: Props) {
  return (
    <div className="bg-brand-surface border border-brand-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
        <div className="font-display text-sm font-bold uppercase tracking-wider">
          P&L · Current vs Prior Period
        </div>
        <button
          onClick={onGenerateAll}
          disabled={anyRunning}
          className="px-3 py-1.5 bg-brand-accent text-black font-display font-bold uppercase text-[11px] tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Play size={10} />
          Generate all
        </button>
      </div>

      <div className="divide-y divide-brand-border">
        {seedPnL.map((line) => {
          const isSelected = selectedId === line.id;
          const isRunning = runningIds.has(line.id);
          const hasCommentary = !!commentaries[line.id];
          return (
            <div
              key={line.id}
              onClick={() => onSelect(line)}
              className={clsx(
                "grid grid-cols-[1fr_100px_100px_100px_70px_90px] gap-3 px-4 py-2 items-center text-xs cursor-pointer transition-colors",
                isSelected && "bg-brand-accent-dim",
                !isSelected && "hover:bg-brand-surface-alt"
              )}
            >
              <div>
                <div className="font-medium text-brand-text">{line.lineItem}</div>
                <div className="font-mono text-[10px] text-brand-text-dim uppercase tracking-wider">
                  {line.category}
                </div>
              </div>
              <div className="font-mono text-right tabular-nums text-brand-text">
                {fmt(line.currentPeriod)}
              </div>
              <div className="font-mono text-right tabular-nums text-brand-text-muted">
                {fmt(line.priorPeriod)}
              </div>
              <div
                className={clsx(
                  "font-mono text-right tabular-nums",
                  line.variance >= 0 ? "text-status-green" : "text-status-red"
                )}
              >
                {line.variance >= 0 ? "+" : ""}
                {fmt(line.variance)}
              </div>
              <div className={clsx("font-mono text-right tabular-nums", pctColor(line.variancePct))}>
                {line.variancePct >= 0 ? "+" : ""}
                {line.variancePct.toFixed(1)}%
              </div>
              <div className="flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerate(line);
                  }}
                  disabled={isRunning || anyRunning}
                  className={clsx(
                    "px-2 py-1 border font-display font-semibold uppercase text-[9px] tracking-wider",
                    hasCommentary
                      ? "border-status-green/60 bg-status-green/10 text-status-green"
                      : "border-brand-border hover:border-brand-accent hover:text-brand-accent",
                    (isRunning || anyRunning) && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isRunning ? "..." : hasCommentary ? "Re-run" : "Generate"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
