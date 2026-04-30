import { useEffect, useState } from "react";
import type { ExecutiveSummary } from "@/agents/narrative";
import { Check, Clipboard, Printer, Presentation, X } from "lucide-react";

export default function ExecSummaryCard({ summary }: { summary: ExecutiveSummary }) {
  const [copied, setCopied] = useState(false);
  const [slideOpen, setSlideOpen] = useState(false);

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
        <button
          onClick={() => setSlideOpen(true)}
          className="px-3 py-2 bg-brand-accent text-black font-display font-bold uppercase text-[11px] tracking-wider hover:opacity-80 flex items-center gap-1"
        >
          <Presentation size={12} />
          Create slide
        </button>
      </div>
      {slideOpen && <SlideViewModal summary={summary} onClose={() => setSlideOpen(false)} />}
    </div>
  );
}

// ─── 16:9 slide preview modal ────────────────────────────────────────────────
function SlideViewModal({
  summary,
  onClose,
}: {
  summary: ExecutiveSummary;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // Stop the body from scrolling under the modal
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const printSlide = () => {
    // Toggle a body-level class and trigger print; print stylesheet narrows
    // the print-region to the slide element only.
    document.body.classList.add("printing-slide");
    window.print();
    // Remove the class after print dialog closes (best-effort)
    window.setTimeout(() => document.body.classList.remove("printing-slide"), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 no-print-overlay"
      onClick={onClose}
    >
      {/* Toolbar above the slide */}
      <div className="w-full max-w-[1100px] flex items-center justify-between mb-4 no-print">
        <div className="font-display text-[10px] font-bold uppercase tracking-[3px] text-brand-text-muted">
          Slide preview · 16:9 · executive close summary
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); printSlide(); }}
            className="px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-brand-accent hover:text-brand-accent flex items-center gap-1"
          >
            <Printer size={12} /> Save as PDF / Print
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="px-3 py-2 bg-brand-surface-alt border border-brand-border font-display font-bold uppercase text-[11px] tracking-wider hover:border-status-red hover:text-status-red flex items-center gap-1"
          >
            <X size={12} /> Close
          </button>
        </div>
      </div>

      {/* The slide itself — 16:9 aspect ratio, fixed dims so print is consistent */}
      <div
        id="exec-summary-slide"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white text-black shadow-2xl"
        style={{ width: "1100px", height: "618.75px" /* 16:9 of 1100 */ }}
      >
        {/* Left brand rail */}
        <div
          className="absolute top-0 bottom-0 left-0 w-[14px]"
          style={{ background: "var(--brand-accent)" }}
        />

        {/* Header band */}
        <div className="absolute top-0 left-[14px] right-0 h-[80px] bg-[#0B1220] text-white px-10 flex items-center justify-between">
          <div>
            <div className="font-display text-[11px] font-bold tracking-[3px] uppercase text-[#7CC4FF]">
              Executive Close Summary
            </div>
            <div className="font-display text-[10px] tracking-[2px] uppercase text-white/60 mt-0.5">
              Nike Controlling · prepared by NOAH
            </div>
          </div>
          <div className="font-mono text-[11px] text-white/70">
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>

        {/* Body */}
        <div className="absolute top-[80px] bottom-[60px] left-[14px] right-0 px-10 py-6 flex flex-col gap-5 overflow-hidden">
          {/* Headline */}
          <div className="font-display text-[28px] font-extrabold leading-[1.15] text-[#0B1220]">
            {summary.headline}
          </div>

          {/* Two columns: highlights + risks */}
          <div className="grid grid-cols-[1.4fr_1fr] gap-8 flex-1 min-h-0">
            <div className="min-w-0">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-[#0B1220]/70 mb-2 pb-1 border-b border-[#0B1220]/15">
                Key Highlights
              </div>
              <ul className="space-y-2">
                {summary.key_highlights.map((h, i) => (
                  <li key={i} className="text-[14px] leading-snug text-[#0B1220] flex gap-2">
                    <span className="text-[var(--brand-accent)] font-bold flex-shrink-0">▸</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
            {summary.risks.length > 0 && (
              <div className="min-w-0">
                <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-[#B45309] mb-2 pb-1 border-b border-[#B45309]/30">
                  Risks
                </div>
                <ul className="space-y-2">
                  {summary.risks.map((r, i) => (
                    <li key={i} className="text-[13px] leading-snug text-[#0B1220]/85 flex gap-2">
                      <span className="text-[#B45309] font-bold flex-shrink-0">!</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="border-t-2 border-[var(--brand-accent)] pt-3">
            <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-[#0B1220]/70 mb-1">
              Recommendation
            </div>
            <div className="text-[15px] font-semibold leading-snug text-[#0B1220]">
              {summary.recommendation}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-[14px] right-0 h-[60px] border-t border-[#0B1220]/10 px-10 flex items-center justify-between">
          <div className="font-display text-[10px] font-bold uppercase tracking-[3px] text-[#0B1220]/60">
            Deloitte · Nike Controlling
          </div>
          <div className="font-mono text-[10px] text-[#0B1220]/50">
            Generated by NOAH · grounded in seeded P&amp;L + close metrics · prompts forbid number fabrication
          </div>
        </div>
      </div>

      <div className="mt-4 max-w-[1100px] text-[11px] text-brand-text-dim font-mono no-print">
        Esc to close · click outside the slide to dismiss · Save as PDF prints just the slide.
      </div>
    </div>
  );
}
