import { create } from "zustand";

export type Phase = "preclose" | "execute" | "validate" | "gate";
export type Entity = "NA" | "EMEA" | "GC" | "APLA" | "Corp" | "Global";
export type EntityState = "idle" | "processing" | "complete";

export interface CloseEvent {
  ts: number;
  text: string;
  kind?: "info" | "agent" | "approval";
}

interface CloseState {
  running: boolean;
  day: number; // 0..6
  activePhase: Phase | null;
  completedPhases: Phase[];
  entities: Record<Entity, EntityState>;
  events: CloseEvent[];
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  pushEvent: (text: string, kind?: CloseEvent["kind"]) => void;
}

const initialEntities: Record<Entity, EntityState> = {
  NA: "idle",
  EMEA: "idle",
  GC: "idle",
  APLA: "idle",
  Corp: "idle",
  Global: "idle",
};

function phaseForDay(day: number): Phase | null {
  if (day <= 0) return null;
  if (day <= 2) return "preclose";
  if (day <= 4) return "execute";
  if (day <= 5) return "validate";
  if (day <= 6) return "gate";
  return null;
}

function phaseLabel(p: Phase): string {
  return { preclose: "Pre-Close", execute: "Execute", validate: "Validate", gate: "Gate" }[p];
}

export const useCloseStore = create<CloseState>((set, get) => ({
  running: false,
  day: 0,
  activePhase: null,
  completedPhases: [],
  entities: { ...initialEntities },
  events: [],
  start: () => set({ running: true }),
  pause: () => set({ running: false }),
  reset: () =>
    set({
      running: false,
      day: 0,
      activePhase: null,
      completedPhases: [],
      entities: { ...initialEntities },
      events: [],
    }),
  tick: () => {
    const s = get();
    if (!s.running || s.day >= 6) {
      if (s.day >= 6 && s.running) set({ running: false });
      return;
    }
    const nextDay = s.day + 1;
    const prevPhase = s.activePhase;
    const nextPhase = phaseForDay(nextDay);
    const advanced = prevPhase && nextPhase && prevPhase !== nextPhase;
    const completed = advanced ? [...s.completedPhases, prevPhase] : s.completedPhases;

    // Entity progression — simple staggered pattern
    const newEntities = { ...s.entities };
    const names: Entity[] = ["NA", "EMEA", "GC", "APLA", "Corp", "Global"];
    const active = Math.min(names.length, Math.ceil((nextDay / 6) * names.length));
    names.forEach((n, i) => {
      if (i < active - 1) newEntities[n] = "complete";
      else if (i === active - 1) newEntities[n] = "processing";
    });

    set({ day: nextDay, activePhase: nextPhase, completedPhases: completed, entities: newEntities });

    const ts = Date.now();
    if (advanced && prevPhase) {
      get().pushEvent(`Phase complete: ${phaseLabel(prevPhase)}`, "agent");
    }
    if (nextPhase && nextPhase !== prevPhase) {
      get().pushEvent(`Phase started: ${phaseLabel(nextPhase)} — Day ${nextDay}/6`, "agent");
    }
    if (nextDay === 6) {
      get().pushEvent(`Close cycle complete — all phases finished`, "approval");
      void ts;
    }
  },
  pushEvent: (text, kind = "info") =>
    set((s) => ({
      events: [...s.events, { ts: Date.now(), text, kind }].slice(-50),
    })),
}));
