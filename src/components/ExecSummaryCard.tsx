import { useState } from "react";
import type { ExecutiveSummary } from "@/agents/narrative";
import { Check, Clipboard, Printer } from "lucide-react";

export default function ExecSummaryCard({ summary }: { summary: ExecutiveSummary }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = [
      summary.headline,
      "",
      "Highlights:",
      ...summary.key_highlights.map((h) => `  • ${h}`),
      ...(summary.risks.length ? ["", "Risks:", ...summary.risks.map((r) => `  ! ${r}`)] : []),
      "",
      `Recommendation: ${summary.recommendation}`,
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
    <div className="bg-brand-surface border border-brand-accent/40 p-6 space-y-5 max-w-3xl">
      <div>
        <div className="font-display text-[10px] font-bold uppercase tracking-[3px] text-brand-accent mb-2">
          Executive Close Summary
        </div>
        <h2 className="font-display text-2xl font-extrabold leading-tight">
          {summary.headline}
        </h2>
      </div>

      <div>
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
          Key Highlights
        </div>
        <ul className="space-y-1">
          {summary.key_highlights.map((h, i) => (
            <li key={i} className="text-sm text-brand-text leading-relaxed flex gap-2">
              <span className="text-brand-accent flex-shrink-0 mt-0.5">▸</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>

      {summary.risks.length > 0 && (
        <div>
          <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-status-amber mb-2">
            Risks
          </div>
          <ul className="space-y-1">
            {summary.risks.map((r, i) => (
              <li key={i} className="text-sm text-brand-text-muted leading-relaxed flex gap-2">
                <span className="text-status-amber flex-shrink-0 mt-0.5">!</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-3 border-t border-brand-border">
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-1">
          Recommendation
        </div>
        <div className="text-base text-brand-text font-medium leading-relaxed">
          {summary.recommendation}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={copy}
          className="px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent hover:text-brand-accent flex items-center gap-1"
        >
          {copied ? <Check size={12} /> : <Clipboard size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={() => window.print()}
          className="px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent hover:text-brand-accent flex items-center gap-1"
        >
          <Printer size={12} />
          Print
        </button>
      </div>
    </div>
  );
}
