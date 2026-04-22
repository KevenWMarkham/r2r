import clsx from "clsx";

export default function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tier = score >= 0.8 ? "green" : score >= 0.5 ? "amber" : "red";
  return (
    <span
      className={clsx(
        "inline-flex items-center font-mono text-[10px] font-semibold px-1.5 py-0.5 border tracking-wide",
        tier === "green" && "text-status-green border-status-green/60 bg-status-green/10",
        tier === "amber" && "text-status-amber border-status-amber/60 bg-status-amber/10",
        tier === "red" && "text-status-red border-status-red/60 bg-status-red/10"
      )}
      title={`Confidence: ${pct}%`}
    >
      {pct}%
    </span>
  );
}
