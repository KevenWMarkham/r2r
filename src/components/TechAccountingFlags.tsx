import type { TechAccountingFlags } from "@/agents/tech-accounting";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";

const METHOD_LABELS = {
  "straight-line": "Straight-line",
  immediate: "Immediate",
  "direct-association": "Direct association",
  unknown: "Unknown — senior review required",
};

export default function TechAccountingFlagsPanel({
  flags,
}: {
  flags: TechAccountingFlags | null;
}) {
  if (!flags) {
    return (
      <div className="text-sm text-brand-text-muted italic">
        Technical accounting not analyzed yet. Run after extraction.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flags.requires_senior_review && (
        <div className="flex items-start gap-2 border border-status-amber bg-status-amber/10 p-3">
          <AlertTriangle size={16} className="text-status-amber flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-display text-xs font-bold uppercase tracking-wider text-status-amber">
              Mandatory Senior Review
            </div>
            <div className="text-xs text-brand-text-muted mt-0.5">
              Flagged due to lease, derivative, or unresolved expense method.
            </div>
          </div>
        </div>
      )}

      <FlagRow
        label="Lease (ASC 840/842)"
        flagged={flags.lease.flagged}
        standard={flags.lease.standard}
        reasoning={flags.lease.reasoning}
      />

      <FlagRow
        label="Embedded Derivative (ASC 815)"
        flagged={flags.derivative.flagged}
        standard={flags.derivative.standard}
        reasoning={flags.derivative.reasoning}
      />

      <div className="border border-brand-border bg-brand-surface-alt p-3">
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-1">
          Expense Recognition Method
        </div>
        <div
          className={clsx(
            "font-mono text-xs",
            flags.expense_method === "unknown" ? "text-status-amber" : "text-brand-text"
          )}
        >
          {METHOD_LABELS[flags.expense_method]}
        </div>
      </div>
    </div>
  );
}

function FlagRow({
  label,
  flagged,
  standard,
  reasoning,
}: {
  label: string;
  flagged: boolean;
  standard: string | null;
  reasoning: string;
}) {
  return (
    <div
      className={clsx(
        "border p-3",
        flagged ? "border-status-red/60 bg-status-red/5" : "border-brand-border bg-brand-surface-alt"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
          {label}
        </span>
        <span
          className={clsx(
            "font-display text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border",
            flagged
              ? "text-status-red border-status-red/60 bg-status-red/10"
              : "text-status-green border-status-green/60 bg-status-green/10"
          )}
        >
          {flagged ? `Flagged${standard ? ` · ${standard}` : ""}` : "Not flagged"}
        </span>
      </div>
      {reasoning && (
        <div className="text-xs text-brand-text-muted leading-relaxed mt-1 break-words">
          {reasoning}
        </div>
      )}
    </div>
  );
}
