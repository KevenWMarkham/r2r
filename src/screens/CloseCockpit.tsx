import { useEffect } from "react";
import { useCloseStore } from "@/store/closeStore";
import PhaseGrid from "@/components/PhaseGrid";
import EntityList from "@/components/EntityList";
import EventLog from "@/components/EventLog";
import { Play, Pause, RotateCcw } from "lucide-react";

const TICK_MS = 1500;

export default function CloseCockpit() {
  const { running, day, start, pause, reset, tick, pushEvent, activePhase } = useCloseStore();

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [running, tick]);

  const onStart = () => {
    if (day === 0) pushEvent("R2R Orchestrator initiated close cycle", "agent");
    start();
  };

  const progressPct = Math.min(100, Math.round((day / 6) * 100));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
          Close Cockpit
        </h1>
        <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
          Scripted simulation of the 6-day monthly close cycle — 4 phases, 6 entities,
          orchestrated by the R2R agent supervisor. Real-AI agents engage on the Contracts and
          Narrative routes.
        </p>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-[2px]">
        {/* Controls + Entities */}
        <div className="bg-brand-surface border border-brand-border p-4">
          <div className="flex gap-1 mb-2">
            <button
              onClick={onStart}
              disabled={running || day >= 6}
              className="flex-1 py-2 px-3 bg-brand-accent text-black font-display font-bold uppercase text-xs tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <Play size={12} /> Start
            </button>
            <button
              onClick={pause}
              disabled={!running}
              className="flex-1 py-2 px-3 bg-status-amber text-black font-display font-bold uppercase text-xs tracking-wider hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <Pause size={12} /> Pause
            </button>
          </div>
          <button
            onClick={reset}
            className="w-full py-2 px-3 bg-brand-surface-alt border border-brand-border text-brand-text-muted font-display font-bold uppercase text-xs tracking-wider hover:text-brand-text hover:border-brand-accent flex items-center justify-center gap-1"
          >
            <RotateCcw size={12} /> Reset
          </button>

          <div className="mt-4 mb-2 font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
            Entities
          </div>
          <EntityList />
        </div>

        {/* Timeline + Phases */}
        <div className="space-y-[2px]">
          <div className="bg-brand-surface border border-brand-border p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="font-display font-bold uppercase tracking-[1px] text-sm">
                Close Progress
              </span>
              <span className="font-mono text-xs text-brand-text-dim">
                DAY {day} / 6 {activePhase ? `· ${activePhase.toUpperCase()}` : ""}
              </span>
            </div>
            <div className="w-full h-1 bg-brand-surface-alt mb-4 overflow-hidden">
              <div
                className="h-full bg-brand-accent transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <PhaseGrid />
          </div>
          <EventLog />
        </div>
      </div>
    </div>
  );
}
