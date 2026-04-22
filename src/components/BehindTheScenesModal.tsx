import type { AgentStep } from "@/adapters";
import { STEP_NARRATIVES } from "@/data/agent-step-narratives";
import { X } from "lucide-react";
import { useEffect } from "react";

export default function BehindTheScenesModal({
  step,
  onClose,
}: {
  step: AgentStep | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;
  const n = STEP_NARRATIVES[step];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-brand-surface border border-brand-accent max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between sticky top-0 bg-brand-surface">
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[3px] text-brand-accent">
              Behind the Scenes
            </div>
            <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight mt-1">
              {n.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center hover:bg-brand-surface-alt border border-brand-border"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="text-sm text-brand-text-muted italic leading-relaxed">
            {n.orchestratorRole}
          </div>

          <Section title="Actions">
            <ul className="list-disc list-inside space-y-1 text-sm text-brand-text-muted">
              {n.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Section>

          <Section title="Systems Involved">
            <ul className="space-y-0.5 font-mono text-xs">
              {n.systems.map((s, i) => (
                <li key={i} className="text-brand-text-muted">
                  <span className="text-brand-accent">▸</span> {s}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Outputs">
            <ul className="space-y-0.5 font-mono text-xs">
              {n.outputs.map((o, i) => (
                <li key={i} className="text-brand-text-muted">
                  <span className="text-status-green">→</span> {o}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Handoff To">
            <div className="text-sm text-brand-text leading-relaxed">{n.handoffTo}</div>
          </Section>

          {n.demoNote && (
            <div className="border-t border-brand-border pt-4">
              <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-accent mb-1">
                Demo Note
              </div>
              <div className="text-xs text-brand-text-muted italic leading-relaxed">
                {n.demoNote}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
