import type { RiskResult } from "@/agents/risk";
import clsx from "clsx";

const COLORS: Record<RiskResult["category"], string> = {
  High: "text-status-red border-status-red/60 bg-status-red/10",
  Medium: "text-status-amber border-status-amber/60 bg-status-amber/10",
  Low: "text-status-green border-status-green/60 bg-status-green/10",
};

export default function RiskPanel({ risk }: { risk: RiskResult | null }) {
  if (!risk) {
    return (
      <div className="text-sm text-brand-text-muted italic">
        Not scored yet. Run the Risk agent after extraction.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
            <circle
              cx="20"
              cy="20"
              r="16"
              stroke="var(--brand-border)"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${(risk.score / 100) * 100.53} 100.53`}
              strokeLinecap="round"
              className={clsx(
                risk.category === "High" && "text-status-red",
                risk.category === "Medium" && "text-status-amber",
                risk.category === "Low" && "text-status-green"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-xl">
            {risk.score}
          </div>
        </div>
        <div>
          <span
            className={clsx(
              "inline-block font-display text-sm font-bold uppercase tracking-[2px] px-3 py-1 border",
              COLORS[risk.category]
            )}
          >
            {risk.category} Risk
          </span>
          <div className="text-xs text-brand-text-muted mt-1 font-mono">
            Rules + LLM signal · score out of 100
          </div>
        </div>
      </div>

      <div>
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-1">
          Contributing Factors
        </div>
        {risk.reasons.length === 0 ? (
          <div className="text-xs text-brand-text-dim italic">No specific risk factors identified.</div>
        ) : (
          <ul className="text-xs text-brand-text-muted space-y-0.5 list-disc list-inside">
            {risk.reasons.map((r, i) => (
              <li key={i} className="break-words">{r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
