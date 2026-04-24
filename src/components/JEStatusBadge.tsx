import clsx from "clsx";
import type { JEStatus } from "@/lib/api-client";

const STYLES: Record<JEStatus, string> = {
  draft:     "text-brand-text-muted border-brand-border bg-brand-surface-alt",
  submitted: "text-status-amber border-status-amber/60 bg-status-amber/10",
  approved:  "text-status-green border-status-green/60 bg-status-green/10",
  rejected:  "text-status-red border-status-red/60 bg-status-red/10",
  posted:    "text-brand-accent border-brand-accent/60 bg-brand-accent-dim",
  reversed:  "text-status-cyan border-status-cyan/60 bg-status-cyan/10",
  voided:    "text-status-red border-status-red/60 bg-status-red/10",
};

const LABELS: Record<JEStatus, string> = {
  draft:     "Draft",
  submitted: "Submitted",
  approved:  "Approved",
  rejected:  "Rejected",
  posted:    "Posted",
  reversed:  "Reversed",
  voided:    "Voided",
};

export default function JEStatusBadge({ status }: { status: JEStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-display text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border",
        STYLES[status]
      )}
    >
      {LABELS[status]}
    </span>
  );
}
