import { useState } from "react";
import type { PnLLine } from "@/data/seed-pnl";
import type { VarianceCommentary } from "@/agents/narrative";
import ConfidenceBadge from "./ConfidenceBadge";
import { Check, Clipboard, Loader2 } from "lucide-react";

interface Props {
  line: PnLLine | null;
  commentary: VarianceCommentary | null;
  running: boolean;
}

export default function CommentaryPanel({ line, commentary, running }: Props) {
  const [copied, setCopied] = useState(false);

  if (!line) {
    return (
      <div className="bg-brand-surface border border-brand-border p-5 h-full flex items-center justify-center text-sm text-brand-text-muted italic">
        Select a line item to generate commentary.
      </div>
    );
  }

  const copy = async () => {
    if (!commentary) return;
    const text = [
      `${line.lineItem} — ${line.variance >= 0 ? "+" : ""}${line.variance.toLocaleString()} (${line.variancePct.toFixed(1)}%)`,
      "",
      commentary.commentary,
      "",
      "Drivers:",
      ...commentary.key_drivers.map((d) => `  • ${d}`),
      ...(commentary.risk_flags.length
        ? ["", "Risk flags:", ...commentary.risk_flags.map((r) => `  ! ${r}`)]
        : []),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="bg-brand-surface border border-brand-border p-5 space-y-4 h-full">
      <div>
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-1">
          Selected Line
        </div>
        <div className="font-display text-lg font-bold">{line.lineItem}</div>
        <div className="font-mono text-xs text-brand-text-muted mt-1">
          {line.variance >= 0 ? "+" : ""}${line.variance.toLocaleString()} ·{" "}
          {line.variancePct.toFixed(1)}% YoY
        </div>
      </div>

      {running ? (
        <div className="flex items-center gap-2 text-status-amber font-mono text-xs">
          <Loader2 size={14} className="animate-spin" />
          NOAH drafting commentary…
        </div>
      ) : commentary ? (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
                Commentary
              </div>
              <ConfidenceBadge score={commentary.confidence} />
            </div>
            <p className="text-sm text-brand-text leading-relaxed fade-in">
              {commentary.commentary}
            </p>
          </div>

          {commentary.key_drivers.length > 0 && (
            <div>
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-1">
                Key Drivers
              </div>
              <ul className="list-disc list-inside text-xs text-brand-text-muted space-y-0.5">
                {commentary.key_drivers.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {commentary.risk_flags.length > 0 && (
            <div className="border-t border-brand-border pt-3">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-status-amber mb-1">
                Risk Flags
              </div>
              <ul className="list-disc list-inside text-xs text-status-amber space-y-0.5">
                {commentary.risk_flags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              onClick={copy}
              className="flex-1 px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent hover:text-brand-accent flex items-center justify-center gap-1"
            >
              {copied ? <Check size={12} /> : <Clipboard size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : (
        <div className="text-sm text-brand-text-muted italic">
          Click Generate to draft commentary for this line.
        </div>
      )}
    </div>
  );
}
