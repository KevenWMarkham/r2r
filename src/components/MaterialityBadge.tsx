import clsx from "clsx";
import type { MaterialityTier } from "@/lib/api-client";

const STYLES: Record<MaterialityTier, string> = {
  standard:   "text-status-green border-status-green/60 bg-status-green/10",
  manager:    "text-status-amber border-status-amber/60 bg-status-amber/10",
  controller: "text-status-red border-status-red/60 bg-status-red/10",
  exec:       "text-status-purple border-status-purple/60 bg-status-purple/10",
};

const LABELS: Record<MaterialityTier, string> = {
  standard:   "Auto · < $100K",
  manager:    "Manager · $100K–$1M",
  controller: "Controller · $1M–$10M",
  exec:       "Executive · > $10M",
};

export default function MaterialityBadge({ tier }: { tier: MaterialityTier | null }) {
  if (!tier) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center font-display text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border",
        STYLES[tier]
      )}
    >
      {LABELS[tier]}
    </span>
  );
}
