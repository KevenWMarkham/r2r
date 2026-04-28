import { create } from "zustand";

const KEY = "noah.ui.liveConsoleVisible";

function loadInitial(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export interface AgentActivityEntry {
  ts: number;
  step: string;        // AgentStep at runtime (kept loose to avoid circular import)
  status: string;      // AgentStatus
  detail?: string;
  source?: string;     // e.g. "contract:CT-1024" or "narrative:variance"
}

interface UiState {
  liveConsoleVisible: boolean;
  setLiveConsoleVisible: (v: boolean) => void;
  toggleLiveConsole: () => void;

  agentFeed: AgentActivityEntry[];
  pushAgentActivity: (e: { step: string; status: string; detail?: string }, source?: string) => void;
  clearAgentFeed: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  liveConsoleVisible: loadInitial(),
  setLiveConsoleVisible: (v) => {
    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      // localStorage unavailable — soft-fail
    }
    set({ liveConsoleVisible: v });
  },
  toggleLiveConsole: () => {
    const next = !get().liveConsoleVisible;
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      // localStorage unavailable — soft-fail
    }
    set({ liveConsoleVisible: next });
  },

  agentFeed: [],
  pushAgentActivity: (e, source) =>
    set((s) => ({
      agentFeed: [
        ...s.agentFeed,
        { ts: Date.now(), step: e.step, status: e.status, detail: e.detail, source },
      ].slice(-100),
    })),
  clearAgentFeed: () => set({ agentFeed: [] }),
}));
