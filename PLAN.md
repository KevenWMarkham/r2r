# NOAH Reference Demo Prototype — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React prototype at `r2r-agentic/Prototype/` that executes the NOAH demo with three real-AI agent flows — contract review (UC-07/08/09), proposed accrual JE (UC-10), and variance commentary + executive narrative (UC-18/20) — through Ollama/Qwen (live mode, Nike theme), plus a canned version deployed to GitHub Pages (Acme theme).

**Architecture:** Three-tier stack for live mode: React SPA (Vite + TS + shadcn/ui) + Node/Express server + PostgreSQL 16 w/ pgvector (Docker). `VITE_MODE=live|canned` switches the Agent adapter (server-backed vs JSON fixtures) and the theme (Nike vs Acme). Canned/Pages mode is static — no server or DB. Deterministic TypeScript computes all JE dollar amounts; LLM only extracts terms. Scripted close simulation and Copilot panel ported from existing HTML artifacts. Contract blobs stored as `bytea` in Postgres with SHA-256 dedup; metabase holds extracted metadata + a `VECTOR(768)` embedding column for semantic search.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind + shadcn/ui, zustand, react-router, pdfjs-dist, mammoth; Node/Express + pg + multer server; PostgreSQL 16 + pgvector (Docker); Ollama (qwen2.5:7b for LLM + nomic-embed-text for embeddings); Vitest, Playwright, GitHub Actions + Pages.

**Reference design:** [`docs/plans/2026-04-20-noah-prototype-design.md`](./2026-04-20-noah-prototype-design.md)

**Reference source HTMLs:**
- `r2r-agentic/NikeR2R-v4-Compare.html` — close simulation, Copilot panel, theme tokens
- `r2r-agentic/nike-r2r-architecture.html` — embedded architecture view
- `r2r-agentic/NOAH-Sprint-Plan.xlsx` — use case acceptance criteria
- **`r2r-agentic/NOAH_Demo_Experience_Guide.docx`** — demo playbook driving prototype UX. The prototype powers **Demo Moment 2** (3-min Contract Review auto-play on slide 7) and **Moment 4** (90-sec executive narrative on slide 10). ContractReview must support an **"Auto" playback mode** (sequences all 8 agent steps at ~3-min pacing) and each step in `AgentActivityStrip` must have a clickable **"Behind the Scenes"** modal showing agent actions, systems, outputs, and handoff. See DESIGN.md §"Alignment to the Demo Experience Guide" for the full mapping and implementation implications.

---

## Phase 0 — Infrastructure (PS-00)

*Docker + PostgreSQL with pgvector + Node/Express backend. Scaffolding files are already created in `docker-compose.yml`, `docker/init.sql`, and `server/`. This phase validates the stack end-to-end before any frontend work.*

### Task 0.1: Bring up Postgres + verify schema

**Step 1:** From `Prototype/`, start Postgres

```powershell
docker compose up -d postgres
```

**Step 2:** Wait for healthy state

```powershell
docker compose ps
# noah-postgres should show "healthy"
```

**Step 3:** Verify schema applied

```powershell
docker exec noah-postgres psql -U noah -d noah -c "\dt"
# Expect: contracts, contract_metabase, audit_events, pnl_lines
docker exec noah-postgres psql -U noah -d noah -c "SELECT extname FROM pg_extension"
# Expect: vector, pgcrypto listed
```

### Task 0.2: Pull Ollama models

```powershell
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
ollama list
# Expect both listed
```

### Task 0.3: Start the server

**Step 1:**

```powershell
cd server
cp .env.example .env
pnpm install
pnpm dev
```

**Step 2:** Verify health

```powershell
curl http://localhost:3001/health
# Expect: {"ok": true, "db": "connected", ...}
```

### Task 0.4: Seed the 5 Acme sample contracts

```powershell
cd server
pnpm seed
# Expect: 5 contracts ingested + embedded + inserted
```

**Verify:**

```powershell
docker exec noah-postgres psql -U noah -d noah -c "SELECT count(*) FROM contracts"        # = 5
docker exec noah-postgres psql -U noah -d noah -c "SELECT count(*) FROM contract_metabase WHERE embedding IS NOT NULL"  # = 5
```

### Task 0.5: Smoke-test semantic search

```powershell
curl -X POST http://localhost:3001/api/search/semantic `
  -H "Content-Type: application/json" `
  -d '{"query":"commercial real estate lease for a data center","limit":3}'
```

**Expected:** Contract_3 (Insurance) should NOT be first; Contract_4 (Construction Retail Remodel) or a lease-adjacent contract should rank high.

### Task 0.6: Phase 0 checkpoint

```powershell
cd ..
git add .
git commit -m "feat(infra): Docker + Postgres + pgvector + server scaffold validated"
git tag ps-00-infra
```

---

## Phase 1 — Foundation (PS-01)

### Task 1.1: Initialize the prototype workspace

**Files:**
- Create: `r2r-agentic/Prototype/` (working directory for all subsequent tasks)
- Create: `r2r-agentic/Prototype/.gitignore`
- Create: `r2r-agentic/Prototype/README.md` (minimal placeholder; full README in Task 6.1)

**Step 1:** Initialize git repo

```powershell
cd r2r-agentic/Prototype
git init
git branch -M main
```

**Step 2:** Create `.gitignore`

```
node_modules
dist
.env
.env.local
*.log
.DS_Store
.vscode
.idea

# Deloitte contracts — NEVER commit
samples/user/**
!samples/user/.gitkeep

# Fixtures generated by dev (committed — exception below)
!fixtures/**
```

**Step 3:** Placeholder README

```markdown
# NOAH Reference Demo Prototype

Implementation in progress. See `../docs/plans/2026-04-20-noah-prototype.md`.
```

**Step 4:** Initial commit

```powershell
git add .gitignore README.md
git commit -m "chore: initialize prototype workspace"
```

---

### Task 1.2: Scaffold Vite + React + TypeScript

**Files:**
- Create: `Prototype/package.json`
- Create: `Prototype/vite.config.ts`
- Create: `Prototype/tsconfig.json`
- Create: `Prototype/index.html`
- Create: `Prototype/src/main.tsx`
- Create: `Prototype/src/App.tsx`

**Step 1:** Scaffold via create-vite (non-interactive)

```powershell
pnpm create vite@latest . --template react-ts
pnpm install
```

**Step 2:** Smoke-test the scaffold

```powershell
pnpm dev
```

Expected: Vite opens localhost:5173 with default React + TS page. Stop the dev server.

**Step 3:** Commit

```powershell
git add .
git commit -m "chore: scaffold Vite + React + TS"
```

---

### Task 1.3: Install core runtime dependencies

**Files:** Modifies `Prototype/package.json`

**Step 1:** Install dependencies

```powershell
pnpm add react-router-dom zustand pdfjs-dist clsx class-variance-authority tailwind-merge lucide-react
pnpm add -D tailwindcss@latest postcss autoprefixer @types/node tsx vitest @vitest/ui @playwright/test
pnpm dlx tailwindcss init -p
```

**Step 2:** Configure Tailwind — replace `tailwind.config.js` content:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'brand-bg': 'var(--brand-bg)',
        'brand-surface': 'var(--brand-surface)',
        'brand-accent': 'var(--brand-accent)',
        'brand-accent-dim': 'var(--brand-accent-dim)',
        'brand-text': 'var(--brand-text)',
        'brand-text-muted': 'var(--brand-text-muted)',
        'brand-border': 'var(--brand-border)',
      },
      fontFamily: {
        display: ['var(--brand-font-display)', 'sans-serif'],
        body: ['var(--brand-font-body)', 'sans-serif'],
        mono: ['var(--brand-font-mono)', 'monospace'],
      },
    },
  },
}
```

**Step 3:** Replace `src/index.css` with Tailwind directives + CSS var defaults:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --brand-bg: #000000;
    --brand-surface: #0d0d0d;
    --brand-accent: #C8FF00;
    --brand-accent-dim: rgba(200,255,0,0.12);
    --brand-text: #ffffff;
    --brand-text-muted: #B0B0B0;
    --brand-border: #2e2e2e;
    --brand-font-display: 'Barlow Condensed', sans-serif;
    --brand-font-body: 'Barlow', sans-serif;
    --brand-font-mono: 'JetBrains Mono', monospace;
  }
  body { @apply bg-brand-bg text-brand-text font-body; }
}
```

**Step 4:** Commit

```powershell
git add .
git commit -m "chore: install tailwind, router, zustand, pdfjs, test tooling"
```

---

### Task 1.4: Configure environment modes

**Files:**
- Create: `Prototype/.env.example`
- Create: `Prototype/src/config/env.ts`
- Modify: `Prototype/vite.config.ts`
- Modify: `Prototype/package.json` (scripts)

**Step 1:** Create `.env.example`

```
VITE_MODE=live
VITE_OLLAMA_URL=http://localhost:11434
VITE_QWEN_MODEL=qwen2.5:7b
```

**Step 2:** Create `src/config/env.ts`

```ts
export type Mode = "live" | "canned";

export const MODE: Mode = (import.meta.env.VITE_MODE as Mode) ?? "live";
export const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL ?? "http://localhost:11434";
export const QWEN_MODEL = import.meta.env.VITE_QWEN_MODEL ?? "qwen2.5:7b";
export const IS_LIVE = MODE === "live";
export const IS_CANNED = MODE === "canned";
```

**Step 3:** Update `package.json` scripts

```json
{
  "scripts": {
    "dev": "vite",
    "dev:canned": "cross-env VITE_MODE=canned vite",
    "build": "tsc -b && vite build",
    "build:pages": "cross-env VITE_MODE=canned vite build --base=/nike-r2r-demo/",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "generate-fixtures": "tsx src/scripts/generate-fixtures.ts",
    "test:prompts": "tsx src/scripts/prompt-regression.ts"
  }
}
```

**Step 4:** Install cross-env

```powershell
pnpm add -D cross-env
```

**Step 5:** Commit

```powershell
git add .
git commit -m "feat: add VITE_MODE env, dual-mode build scripts"
```

---

### Task 1.5: Theme resolver (Nike + Acme)

**Files:**
- Create: `Prototype/src/theme/nike.ts`
- Create: `Prototype/src/theme/acme.ts`
- Create: `Prototype/src/theme/index.ts`
- Create: `Prototype/src/theme/types.ts`

**Step 1:** Define theme type

```ts
// src/theme/types.ts
export interface Theme {
  name: "nike" | "acme";
  brandName: string;
  productName: string;
  tagline: string;
  colors: {
    bg: string; surface: string; border: string;
    accent: string; accentDim: string;
    text: string; textMuted: string;
  };
  fonts: { display: string; body: string; mono: string };
}
```

**Step 2:** Nike theme — colors pulled from `NikeR2R-v4-Compare.html` lines 10-18 + 45-54

```ts
// src/theme/nike.ts
import { Theme } from "./types";
export const nikeTheme: Theme = {
  name: "nike",
  brandName: "NIKE",
  productName: "NOAH",
  tagline: "Agentic Record-to-Report",
  colors: {
    bg: "#000000", surface: "#0d0d0d", border: "#2e2e2e",
    accent: "#C8FF00", accentDim: "rgba(200,255,0,0.12)",
    text: "#ffffff", textMuted: "#B0B0B0",
  },
  fonts: {
    display: "'Barlow Condensed', sans-serif",
    body: "'Barlow', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
};
```

**Step 3:** Acme theme — neutral, presentable, distinct from Nike

```ts
// src/theme/acme.ts
import { Theme } from "./types";
export const acmeTheme: Theme = {
  name: "acme",
  brandName: "ACME CO",
  productName: "RECAL",
  tagline: "Agentic Financial Close",
  colors: {
    bg: "#0A0E1A", surface: "#121829", border: "#1f2940",
    accent: "#4F9EF8", accentDim: "rgba(79,158,248,0.14)",
    text: "#ffffff", textMuted: "#A7B0C4",
  },
  fonts: {
    display: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
};
```

**Step 4:** Mode-aware resolver + CSS var injector

```ts
// src/theme/index.ts
import { MODE } from "@/config/env";
import { nikeTheme } from "./nike";
import { acmeTheme } from "./acme";
import type { Theme } from "./types";

export const theme: Theme = MODE === "canned" ? acmeTheme : nikeTheme;

export function applyThemeToRoot() {
  const root = document.documentElement;
  root.style.setProperty("--brand-bg", theme.colors.bg);
  root.style.setProperty("--brand-surface", theme.colors.surface);
  root.style.setProperty("--brand-accent", theme.colors.accent);
  root.style.setProperty("--brand-accent-dim", theme.colors.accentDim);
  root.style.setProperty("--brand-text", theme.colors.text);
  root.style.setProperty("--brand-text-muted", theme.colors.textMuted);
  root.style.setProperty("--brand-border", theme.colors.border);
  root.style.setProperty("--brand-font-display", theme.fonts.display);
  root.style.setProperty("--brand-font-body", theme.fonts.body);
  root.style.setProperty("--brand-font-mono", theme.fonts.mono);
}
```

**Step 5:** Configure `@/` path alias in `vite.config.ts` and `tsconfig.json`

```ts
// vite.config.ts
import path from "node:path";
// inside defineConfig({ resolve: { alias: { "@": path.resolve(__dirname, "src") } } })
```

```json
// tsconfig.json compilerOptions
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

**Step 6:** Commit

```powershell
git add .
git commit -m "feat: theme resolver with Nike + Acme themes"
```

---

### Task 1.6: App shell + router

**Files:**
- Modify: `Prototype/src/main.tsx`
- Rewrite: `Prototype/src/App.tsx`
- Create: `Prototype/src/components/Layout.tsx`
- Create: `Prototype/src/components/ModeBanner.tsx`
- Create: `Prototype/src/screens/CloseCockpit.tsx` (placeholder)
- Create: `Prototype/src/screens/ContractQueue.tsx` (placeholder)
- Create: `Prototype/src/screens/ContractReview.tsx` (placeholder)
- Create: `Prototype/src/screens/AccrualProposal.tsx` (placeholder)
- Create: `Prototype/src/screens/CopilotPanel.tsx` (placeholder)

**Step 1:** `src/main.tsx` — invoke theme + router

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { applyThemeToRoot } from "@/theme";
import "./index.css";

applyThemeToRoot();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

**Step 2:** `src/App.tsx` — routes + layout

```tsx
import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import CloseCockpit from "@/screens/CloseCockpit";
import ContractQueue from "@/screens/ContractQueue";
import ContractReview from "@/screens/ContractReview";
import AccrualProposal from "@/screens/AccrualProposal";
import CopilotPanel from "@/screens/CopilotPanel";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CloseCockpit />} />
        <Route path="contracts" element={<ContractQueue />} />
        <Route path="contracts/:id" element={<ContractReview />} />
        <Route path="contracts/:id/accrual" element={<AccrualProposal />} />
        <Route path="copilot" element={<CopilotPanel />} />
      </Route>
    </Routes>
  );
}
```

**Step 3:** `src/components/Layout.tsx` — header + nav + outlet

```tsx
import { NavLink, Outlet } from "react-router-dom";
import { theme } from "@/theme";
import ModeBanner from "./ModeBanner";

export default function Layout() {
  return (
    <div className="min-h-screen">
      <ModeBanner />
      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/80 border-b border-brand-border px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-display text-2xl font-extrabold tracking-[2px]">{theme.brandName}</span>
          <div className="w-px h-5 bg-brand-border" />
          <span className="font-display text-sm font-semibold text-brand-text-muted tracking-[1.5px] uppercase">
            {theme.productName} · {theme.tagline}
          </span>
        </div>
      </header>
      <nav className="sticky top-16 z-40 bg-black/90 backdrop-blur border-b border-brand-border px-10 flex gap-0">
        {[
          { to: "/", label: "Close Cockpit" },
          { to: "/contracts", label: "Contracts" },
          { to: "/copilot", label: "Copilot" },
        ].map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) =>
            `px-6 py-3 font-display text-sm font-semibold uppercase tracking-[1px] border-b-2 ${
              isActive ? "text-brand-text border-brand-accent" : "text-brand-text-muted border-transparent hover:text-brand-text"
            }`
          }>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="max-w-[1400px] mx-auto px-10 py-14"><Outlet /></main>
    </div>
  );
}
```

**Step 4:** `src/components/ModeBanner.tsx`

```tsx
import { useEffect, useState } from "react";
import { MODE, QWEN_MODEL, OLLAMA_URL } from "@/config/env";

export default function ModeBanner() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") setHidden(h => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (hidden || import.meta.env.PROD) return null;
  const label = MODE === "live" ? `LIVE · ${QWEN_MODEL} @ ${OLLAMA_URL}` : "CANNED · pre-recorded fixtures";
  const bg = MODE === "live" ? "bg-emerald-900/80" : "bg-amber-900/80";
  return (
    <div className={`${bg} text-white text-xs font-mono px-4 py-1 text-center`}>
      {label} · Ctrl+Shift+D to toggle
    </div>
  );
}
```

**Step 5:** Placeholder screens — each file:

```tsx
// e.g. src/screens/CloseCockpit.tsx
export default function CloseCockpit() {
  return <div className="font-display text-3xl uppercase">Close Cockpit — coming in Task 1.8</div>;
}
```

(Repeat with appropriate heading text for ContractQueue, ContractReview, AccrualProposal, CopilotPanel.)

**Step 6:** Run dev server and verify layout renders, nav works, ModeBanner visible in green

```powershell
pnpm dev
```

**Step 7:** Commit

```powershell
git add .
git commit -m "feat: app shell, router, layout, mode banner"
```

---

### Task 1.7: Ollama client

**Files:**
- Create: `Prototype/src/agents/ollama-client.ts`
- Create: `Prototype/src/agents/ollama-client.test.ts`

**Step 1:** Write failing test (mocked fetch)

```ts
// src/agents/ollama-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { chatJSON, OllamaError } from "./ollama-client";

beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });

describe("chatJSON", () => {
  it("returns parsed JSON on success", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{"foo":1}' } }),
    });
    const result = await chatJSON({ prompt: "hi", schemaHint: "" });
    expect(result).toEqual({ foo: 1 });
  });

  it("throws OllamaError when response is not JSON", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: "not json at all" } }),
    });
    await expect(chatJSON({ prompt: "hi", schemaHint: "" })).rejects.toThrow(OllamaError);
  });
});
```

**Step 2:** Run — expect fail

```powershell
pnpm test src/agents/ollama-client.test.ts
```

**Step 3:** Implement

```ts
// src/agents/ollama-client.ts
import { OLLAMA_URL, QWEN_MODEL } from "@/config/env";

export class OllamaError extends Error {}

export async function checkHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    return r.ok;
  } catch { return false; }
}

export interface ChatArgs {
  prompt: string;
  schemaHint: string;
  system?: string;
  temperature?: number;
}

export async function chatJSON<T = unknown>(args: ChatArgs): Promise<T> {
  const body = {
    model: QWEN_MODEL,
    stream: false,
    format: "json",
    options: { temperature: args.temperature ?? 0.1 },
    messages: [
      ...(args.system ? [{ role: "system", content: args.system }] : []),
      { role: "user", content: `${args.prompt}\n\nRespond with valid JSON matching:\n${args.schemaHint}` },
    ],
  };
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new OllamaError(`HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.message?.content ?? "";
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new OllamaError(`Model returned non-JSON: ${content.slice(0, 200)}`);
  }
}
```

**Step 4:** Run tests — expect pass

```powershell
pnpm test src/agents/ollama-client.test.ts
```

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(agents): Ollama client with JSON mode + health check"
```

---

### Task 1.8: Port close-cycle simulation from existing HTML

**Files:**
- Rewrite: `Prototype/src/screens/CloseCockpit.tsx`
- Create: `Prototype/src/components/PhaseGrid.tsx`
- Create: `Prototype/src/components/EntityList.tsx`
- Create: `Prototype/src/components/EventLog.tsx`
- Create: `Prototype/src/store/closeStore.ts`
- Reference: `r2r-agentic/NikeR2R-v4-Compare.html` lines 504-543 (simulation section) and JS around line 800+

**Step 1:** Open the reference HTML and locate the simulation state machine (4 phases × 6 entities × timeline).

Read lines 504-543 for the DOM structure; read the JS block (bottom of file) for phase durations, entity progression, and event log messages. These are your source of truth for the scripted sim.

**Step 2:** Create `src/store/closeStore.ts` with zustand

```ts
import { create } from "zustand";

export type Phase = "preclose" | "execute" | "validate" | "gate";
export type Entity = "NA" | "EMEA" | "GC" | "APLA" | "Corp" | "Global";
export type EntityState = "idle" | "processing" | "complete";

interface CloseState {
  running: boolean;
  day: number;           // 0..6
  activePhase: Phase | null;
  completedPhases: Phase[];
  entities: Record<Entity, EntityState>;
  events: { ts: number; text: string }[];
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  pushEvent: (text: string) => void;
}

const initialEntities: Record<Entity, EntityState> = {
  NA: "idle", EMEA: "idle", GC: "idle", APLA: "idle", Corp: "idle", Global: "idle",
};

export const useCloseStore = create<CloseState>((set, get) => ({
  running: false,
  day: 0,
  activePhase: null,
  completedPhases: [],
  entities: { ...initialEntities },
  events: [],
  start: () => set({ running: true }),
  pause: () => set({ running: false }),
  reset: () => set({ running: false, day: 0, activePhase: null, completedPhases: [], entities: { ...initialEntities }, events: [] }),
  tick: () => {
    const s = get();
    if (!s.running || s.day >= 6) return;
    const nextDay = s.day + 1;
    const phase: Phase | null =
      nextDay <= 2 ? "preclose" :
      nextDay <= 4 ? "execute" :
      nextDay <= 5 ? "validate" :
      nextDay <= 6 ? "gate" : null;
    set({ day: nextDay, activePhase: phase });
  },
  pushEvent: (text) => set(s => ({ events: [...s.events, { ts: Date.now(), text }].slice(-50) })),
}));
```

**Step 3:** Implement `PhaseGrid`, `EntityList`, `EventLog` as presentational components reading from `useCloseStore`. Match visual style from the HTML (phase cards with active border, entity status dots).

**Step 4:** Wire `CloseCockpit` with Start/Pause/Reset buttons driving the store; `setInterval(tick, 1500)` while running.

**Step 5:** Visual smoke check — run `pnpm dev`, click Start, verify phases advance and events log.

**Step 6:** Commit

```powershell
git add .
git commit -m "feat(close): port close-cycle simulation to React"
```

---

### Task 1.9: Port Copilot chat panel (scripted)

**Files:**
- Rewrite: `Prototype/src/screens/CopilotPanel.tsx`
- Create: `Prototype/src/data/copilot-canned-answers.ts`
- Reference: `r2r-agentic/NikeR2R-v4-Compare.html` lines 545-570

**Step 1:** Build canned answer table keyed by keyword matching

```ts
// src/data/copilot-canned-answers.ts
export interface CannedAnswer { match: RegExp; reply: string; }
export const cannedAnswers: CannedAnswer[] = [
  { match: /close status|where are we/i, reply: "NA close is in Phase 2 (Execute), Day 3 of 6. 847 accounts reconciled, 12 exceptions above materiality pending review." },
  { match: /exceptions|recon/i, reply: "12 exceptions above $500K materiality — top 3: GL 4211 ($1.2M variance), GL 6831 ($890K variance), GL 2114 ($670K variance)." },
  { match: /contract/i, reply: "34 contracts > $1M this period; 8 flagged for manager review. Head to the Contracts tab for risk-ranked queue." },
  { match: /accrual/i, reply: "Proposed accruals total $14.2M this period. 23 auto-calculated, 4 awaiting Marcus's approval." },
  { match: /.*/, reply: "I can help with close status, exceptions, contracts, entities, or accruals. What do you need?" },
];
```

**Step 2:** Implement chat UI — input + messages + "thinking" delay (400ms) before showing reply.

**Step 3:** Visual smoke check with a few questions.

**Step 4:** Commit

```powershell
git add .
git commit -m "feat(copilot): scripted chat panel"
```

---

### Task 1.10: PDF ingest utility

**Files:**
- Create: `Prototype/src/lib/pdf.ts`
- Create: `Prototype/src/lib/pdf.test.ts`
- Modify: `Prototype/vite.config.ts` (pdfjs worker config)

**Step 1:** Write failing test

```ts
// src/lib/pdf.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractPdfText } from "./pdf";

describe("extractPdfText", () => {
  it("returns empty-ish for non-pdf buffer", async () => {
    const bad = new Uint8Array([1, 2, 3]);
    await expect(extractPdfText(bad)).rejects.toThrow();
  });
});
```

**Step 2:** Run — expect fail

**Step 3:** Implement

```ts
// src/lib/pdf.ts
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PageSpan { page: number; text: string; }
export interface ExtractedPdf {
  fullText: string;
  pages: PageSpan[];
  hash: string;
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdf> {
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: PageSpan[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const content = await p.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    pages.push({ page: i, text });
  }
  const fullText = pages.map(p => p.text).join("\n\n");
  const hash = await sha256(bytes);
  return { fullText, pages, hash };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function assertEnoughText(pdf: ExtractedPdf, minChars = 200): void {
  if (pdf.fullText.trim().length < minChars) {
    throw new Error("Scanned PDF detected — OCR not included in prototype. Please use a text-based PDF.");
  }
}
```

**Step 4:** Run tests — expect pass

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(pdf): PDF ingest with page spans + SHA-256 hash"
```

---

### Task 1.11: Phase 1 checkpoint

**Step 1:** Smoke test

```powershell
pnpm dev
```

Verify:
- Nike theme renders (volt yellow accents)
- Close Cockpit animates through phases
- Copilot panel responds to "close status"
- ModeBanner shows "LIVE · qwen2.5:7b"
- All placeholder routes render

**Step 2:** Tag milestone

```powershell
git tag ps-01-foundation
```

---

## Phase 2 — UC-07: Contract Attribute Extraction (PS-02)

### Task 2.1: Define contract attribute schema

**Files:**
- Create: `Prototype/src/agents/contract-schema.ts`
- Create: `Prototype/src/agents/contract-schema.test.ts`
- Reference: `NOAH-Sprint-Plan.xlsx` UC-07 ("27 standard attributes")

**Step 1:** Write failing test for schema validation

```ts
// src/agents/contract-schema.test.ts
import { describe, it, expect } from "vitest";
import { ContractAttributesSchema, CONTRACT_ATTRIBUTE_NAMES } from "./contract-schema";

describe("contract schema", () => {
  it("lists 27 attributes", () => {
    expect(CONTRACT_ATTRIBUTE_NAMES).toHaveLength(27);
  });
  it("validates well-formed attributes", () => {
    const valid = {
      counterparty: { value: "Beeline Inc", confidence: 0.9, source_page: 1 },
      // ... 26 more
    };
    const result = ContractAttributesSchema.safeParse(valid);
    expect(result.success).toBe(false); // missing fields, validates structure requirement
  });
});
```

**Step 2:** Run — expect fail

**Step 3:** Install zod + implement

```powershell
pnpm add zod
```

```ts
// src/agents/contract-schema.ts
import { z } from "zod";

export const CONTRACT_ATTRIBUTE_NAMES = [
  "counterparty", "contract_type", "effective_date", "expiration_date",
  "total_contract_value", "currency", "payment_terms", "billing_frequency",
  "fee_schedule", "service_description", "service_start_date", "service_end_date",
  "auto_renewal", "termination_notice_days", "governing_law", "indemnification_present",
  "liability_cap", "lease_component", "embedded_derivative", "expense_recognition_method",
  "performance_obligations", "pricing_variability", "minimum_commitment", "exclusivity_clause",
  "ip_ownership", "confidentiality_term", "change_order_mechanism",
] as const;

const Field = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(1),
  source_page: z.number().int().min(1).nullable(),
});

export const ContractAttributesSchema = z.object(
  Object.fromEntries(CONTRACT_ATTRIBUTE_NAMES.map(n => [n, Field])) as Record<typeof CONTRACT_ATTRIBUTE_NAMES[number], typeof Field>
);

export type ContractAttributes = z.infer<typeof ContractAttributesSchema>;
```

**Step 4:** Run tests — expect pass

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(agents): 27-attribute contract schema with zod"
```

---

### Task 2.2: Extractor agent (UC-07)

**Files:**
- Create: `Prototype/src/agents/extractor.ts`
- Create: `Prototype/src/agents/extractor.test.ts`

**Step 1:** Write failing test with mocked Ollama client

```ts
// src/agents/extractor.test.ts
import { describe, it, expect, vi } from "vitest";
vi.mock("./ollama-client");
import { chatJSON } from "./ollama-client";
import { extractAttributes } from "./extractor";
import { CONTRACT_ATTRIBUTE_NAMES } from "./contract-schema";

describe("extractAttributes", () => {
  it("returns validated attributes", async () => {
    const mockOutput = Object.fromEntries(CONTRACT_ATTRIBUTE_NAMES.map(n => [n, { value: null, confidence: 0.1, source_page: null }]));
    (chatJSON as any).mockResolvedValue(mockOutput);
    const result = await extractAttributes({ fullText: "sample contract text", pages: [{ page: 1, text: "sample" }], hash: "abc" } as any);
    expect(Object.keys(result)).toHaveLength(27);
  });
});
```

**Step 2:** Run — expect fail

**Step 3:** Implement

```ts
// src/agents/extractor.ts
import { chatJSON, OllamaError } from "./ollama-client";
import { ContractAttributesSchema, CONTRACT_ATTRIBUTE_NAMES, type ContractAttributes } from "./contract-schema";
import type { ExtractedPdf } from "@/lib/pdf";

const SYSTEM = `You are a meticulous contract analyst. Extract exactly 27 attributes from contracts. For each attribute, provide value (string/number/boolean/null), confidence (0.0-1.0), and source_page (the 1-indexed PDF page the value came from, or null). Never guess — set confidence low and value null if unclear.`;

const SCHEMA_HINT = `{
  ${CONTRACT_ATTRIBUTE_NAMES.map(n => `"${n}": { "value": any, "confidence": 0..1, "source_page": int|null }`).join(",\n  ")}
}`;

export async function extractAttributes(pdf: ExtractedPdf): Promise<ContractAttributes> {
  const prompt = `Contract text (pages delimited):\n\n${pdf.pages.map(p => `[PAGE ${p.page}]\n${p.text}`).join("\n\n")}`;
  let raw: unknown;
  try {
    raw = await chatJSON({ system: SYSTEM, prompt, schemaHint: SCHEMA_HINT });
  } catch (e) {
    if (e instanceof OllamaError) {
      raw = await chatJSON({ system: SYSTEM, prompt: prompt + "\n\nYour previous response was invalid JSON. Please retry and ensure valid JSON.", schemaHint: SCHEMA_HINT });
    } else throw e;
  }
  const parsed = ContractAttributesSchema.safeParse(raw);
  if (!parsed.success) {
    // Degrade — return null-filled with warning
    return Object.fromEntries(CONTRACT_ATTRIBUTE_NAMES.map(n => [n, { value: null, confidence: 0, source_page: null }])) as ContractAttributes;
  }
  return parsed.data;
}
```

**Step 4:** Run tests — expect pass

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(agents): UC-07 contract attribute extractor"
```

---

### Task 2.3: Agent adapter interface + LiveAgent

**Files:**
- Create: `Prototype/src/adapters/agent-interface.ts`
- Create: `Prototype/src/adapters/live-agent.ts`
- Create: `Prototype/src/adapters/index.ts`

**Step 1:** Define interface

```ts
// src/adapters/agent-interface.ts
import type { ExtractedPdf } from "@/lib/pdf";
import type { ContractAttributes } from "@/agents/contract-schema";

export type AgentEvent =
  | { type: "step"; step: "extract" | "risk" | "techAcct" | "accrual"; status: "start" | "done" | "error"; detail?: string };

export interface AgentCallbacks { onEvent?: (e: AgentEvent) => void; }

export interface Agent {
  extractAttributes(pdf: ExtractedPdf, cb?: AgentCallbacks): Promise<ContractAttributes>;
  // risk, techAcct, accrual added in later tasks
}
```

**Step 2:** Implement LiveAgent

```ts
// src/adapters/live-agent.ts
import { extractAttributes as runExtract } from "@/agents/extractor";
import type { Agent, AgentCallbacks } from "./agent-interface";
import type { ExtractedPdf } from "@/lib/pdf";

export class LiveAgent implements Agent {
  async extractAttributes(pdf: ExtractedPdf, cb?: AgentCallbacks) {
    cb?.onEvent?.({ type: "step", step: "extract", status: "start" });
    try {
      const r = await runExtract(pdf);
      cb?.onEvent?.({ type: "step", step: "extract", status: "done" });
      return r;
    } catch (e) {
      cb?.onEvent?.({ type: "step", step: "extract", status: "error", detail: String(e) });
      throw e;
    }
  }
}
```

**Step 3:** Mode-aware resolver

```ts
// src/adapters/index.ts
import { MODE } from "@/config/env";
import { LiveAgent } from "./live-agent";
// CannedAgent imported in Task 5.1
import type { Agent } from "./agent-interface";

export const agent: Agent = MODE === "canned"
  ? (() => { throw new Error("CannedAgent wired in Task 5.1"); })()
  : new LiveAgent();
```

**Step 4:** Temporary: skip the throw for build — export a stub until Task 5.1

```ts
// src/adapters/index.ts (temporary)
export const agent: Agent = new LiveAgent();
```

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(adapters): Agent interface + LiveAgent"
```

---

### Task 2.4: Contract queue screen (UC-08 stub)

**Files:**
- Create: `Prototype/src/store/contractStore.ts`
- Create: `Prototype/src/data/seed-contracts.ts`
- Rewrite: `Prototype/src/screens/ContractQueue.tsx`

**Step 1:** Seed data — 4-5 placeholder contracts (will be overridden by real uploads)

```ts
// src/data/seed-contracts.ts
export interface SeededContract {
  id: string; title: string; counterparty: string; tcv: string;
  risk: "high" | "medium" | "low"; riskScore: number; status: "pending" | "reviewed";
}
export const seedContracts: SeededContract[] = [
  { id: "C-001", title: "Advertising Campaign", counterparty: "Contract 1 counterparty", tcv: "$—", risk: "medium", riskScore: 60, status: "pending" },
  { id: "C-002", title: "Professional Services Outsourcing", counterparty: "Contract 2 counterparty", tcv: "$—", risk: "medium", riskScore: 55, status: "pending" },
  { id: "C-003", title: "Insurance (Multi-Year)", counterparty: "Contract 3 counterparty", tcv: "$—", risk: "high", riskScore: 75, status: "pending" },
  { id: "C-004", title: "Construction — Retail Remodel", counterparty: "Contract 4 counterparty", tcv: "$—", risk: "high", riskScore: 82, status: "pending" },
  { id: "C-005", title: "AWS Enterprise Agreement", counterparty: "Amazon Web Services", tcv: "$—", risk: "high", riskScore: 88, status: "pending" },
];
```

**Step 2:** `contractStore.ts` — zustand holding uploaded contracts + extraction results

```ts
import { create } from "zustand";
import type { ContractAttributes } from "@/agents/contract-schema";
import { seedContracts, type SeededContract } from "@/data/seed-contracts";

export interface UploadedContract {
  id: string; fileName: string; hash: string; uploadedAt: number;
  attributes?: ContractAttributes;
  // risk, techAcct, accrual added later
}

interface S {
  seeds: SeededContract[];
  uploaded: UploadedContract[];
  addUpload: (c: UploadedContract) => void;
  updateUpload: (id: string, patch: Partial<UploadedContract>) => void;
  getById: (id: string) => UploadedContract | SeededContract | undefined;
}

export const useContractStore = create<S>((set, get) => ({
  seeds: seedContracts,
  uploaded: [],
  addUpload: (c) => set(s => ({ uploaded: [c, ...s.uploaded] })),
  updateUpload: (id, patch) => set(s => ({ uploaded: s.uploaded.map(u => u.id === id ? { ...u, ...patch } : u) })),
  getById: (id) => {
    const s = get();
    return s.uploaded.find(u => u.id === id) ?? s.seeds.find(u => u.id === id);
  },
}));
```

**Step 3:** `ContractQueue` — list with upload button, sort by risk

```tsx
// Key UX: drop-zone for PDF upload → calls extractPdfText → adds to store → navigates to ContractReview
```

(Use shadcn/ui or custom — render a table with columns: Title, Counterparty, TCV, Risk Badge, Action. Above it: drag-drop zone with file input fallback.)

**Step 4:** Visual smoke check — upload a test PDF, verify it appears in the queue with placeholder risk until agents run.

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(contracts): queue screen with upload + seed data"
```

---

### Task 2.5: Contract review screen with live extraction

**Files:**
- Create: `Prototype/src/components/AgentActivityStrip.tsx`
- Create: `Prototype/src/components/ConfidenceBadge.tsx`
- Create: `Prototype/src/components/AttributeChecklist.tsx`
- Create: `Prototype/src/components/PdfViewer.tsx`
- Rewrite: `Prototype/src/screens/ContractReview.tsx`

**Step 1:** `AgentActivityStrip` — consumes `AgentEvent` stream, shows 4-step progress (only Extract lit for now)

**Step 2:** `ConfidenceBadge` — green ≥0.8, amber 0.5–0.79, red <0.5, numeric display

**Step 3:** `AttributeChecklist` — renders 27 rows with field name, value, confidence badge, "page N" link

**Step 4:** `PdfViewer` — pdfjs-dist canvas render, page nav

**Step 5:** `ContractReview` — loads contract from store; if no attributes yet, calls `agent.extractAttributes(pdf, { onEvent: pushToStrip })`; renders strip + viewer + checklist side-by-side

**Step 6:** Manual test — start Ollama, run `pnpm dev`, upload a contract, verify:
- Agent strip animates Extract → done
- Attributes populate with confidence
- Low-confidence fields show amber/red

**Step 7:** Commit

```powershell
git add .
git commit -m "feat(contracts): live extraction UI with agent strip and checklist"
```

---

### Task 2.6: Ollama pre-flight check

**Files:**
- Create: `Prototype/src/components/OllamaGuard.tsx`
- Modify: `Prototype/src/components/Layout.tsx`

**Step 1:** `OllamaGuard` — on mount calls `checkHealth()`; if false and MODE==="live", shows blocking modal with instructions and Retry button

**Step 2:** Wrap `/contracts` route output with guard (not the whole app — Close Cockpit should still work offline)

**Step 3:** Manual test — stop Ollama, navigate to `/contracts`, verify modal; start Ollama, click Retry, verify unblocks

**Step 4:** Commit

```powershell
git add .
git commit -m "feat(guard): Ollama pre-flight check on live-mode agent screens"
```

---

### Task 2.7: Phase 2 checkpoint

**Step 1:** End-to-end manual test with a real PDF

**Step 2:** Tag

```powershell
git tag ps-02-uc07
```

---

## Phase 3 — UC-08 + UC-09: Risk & Technical Accounting (PS-03)

### Task 3.1: Risk scoring module (UC-08)

**Files:**
- Create: `Prototype/src/agents/risk.ts`
- Create: `Prototype/src/agents/risk.test.ts`

**Step 1:** Define scoring model — hybrid of deterministic rules + LLM signal

```ts
// Rules (TypeScript) contribute 0–60 points; LLM qualitative signal 0–40
// Rules: TCV >$5M (+15), auto-renewal (+10), no liability cap (+15),
//        lease component (+10), embedded derivative (+10)
// LLM signal: "what's risky about this contract?" → score 0–40
```

**Step 2:** TDD rules function

```ts
// src/agents/risk.test.ts
import { describe, it, expect } from "vitest";
import { scoreRules } from "./risk";

describe("scoreRules", () => {
  it("flags high TCV", () => {
    const pts = scoreRules({ tcv: 6_000_000, autoRenew: false, liabilityCap: true, lease: false, derivative: false });
    expect(pts).toBe(15);
  });
  it("stacks multiple risks", () => {
    const pts = scoreRules({ tcv: 10_000_000, autoRenew: true, liabilityCap: false, lease: true, derivative: true });
    expect(pts).toBe(60);
  });
});
```

**Step 3:** Run — expect fail

**Step 4:** Implement `scoreRules` + `scoreLLM` + `totalRisk` returning `{ score, category, reasons[] }`

**Step 5:** Run tests — expect pass

**Step 6:** Commit

```powershell
git add .
git commit -m "feat(agents): UC-08 risk scoring (rules + LLM signal)"
```

---

### Task 3.2: Technical accounting classifier (UC-09)

**Files:**
- Create: `Prototype/src/agents/tech-accounting.ts`
- Create: `Prototype/src/agents/tech-accounting.test.ts`

**Step 1:** Schema + prompt

```ts
export interface TechAccountingFlags {
  lease: { flagged: boolean; standard: "ASC 840" | "ASC 842" | null; reasoning: string };
  derivative: { flagged: boolean; standard: "ASC 815" | null; reasoning: string };
  expense_method: "straight-line" | "immediate" | "direct-association" | "unknown";
  requires_senior_review: boolean;
}
```

**Step 2:** TDD — mock Ollama, verify shape returned

**Step 3:** Implement `flagTechnicalAccounting(attrs, fullText)` — constructs targeted prompt, parses, returns validated flags

**Step 4:** Run tests — expect pass

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(agents): UC-09 technical accounting classifier (ASC 840/842/815)"
```

---

### Task 3.3: Extend LiveAgent with risk + tech-acct

**Files:**
- Modify: `Prototype/src/adapters/agent-interface.ts`
- Modify: `Prototype/src/adapters/live-agent.ts`
- Modify: `Prototype/src/store/contractStore.ts` (add risk + techAcct fields)

**Step 1:** Add `scoreRisk` and `flagTechnicalAccounting` to `Agent` interface

**Step 2:** Implement in LiveAgent with event emission

**Step 3:** Update `UploadedContract` type with optional `risk` and `techAcct` fields

**Step 4:** Commit

```powershell
git add .
git commit -m "feat(adapters): wire risk + tech-acct through LiveAgent"
```

---

### Task 3.4: Contract review UI — risk + flags

**Files:**
- Modify: `Prototype/src/components/AgentActivityStrip.tsx` (4 steps now active)
- Create: `Prototype/src/components/RiskPanel.tsx`
- Create: `Prototype/src/components/TechAccountingFlags.tsx`
- Modify: `Prototype/src/screens/ContractReview.tsx` (call all 3 agents in sequence)
- Modify: `Prototype/src/screens/ContractQueue.tsx` (sort by risk score)

**Step 1:** After extractor, run risk, then tech-acct (sequential)

**Step 2:** Render risk panel (score gauge, category badge, reasons list) and tech-acct flags (ASC tags, expense method, senior review required banner if true)

**Step 3:** Queue sorts uploads by risk score descending

**Step 4:** Manual test — re-upload a contract, verify all 3 agents complete and UI populates

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(contracts): risk panel + technical accounting flags UI"
```

---

### Task 3.5: Phase 3 checkpoint

**Step 1:** Tag

```powershell
git tag ps-03-uc08-uc09
```

---

## Phase 4 — UC-10: Accrual Calculation & JE (PS-04)

### Task 4.1: Accrual inputs extraction

**Files:**
- Create: `Prototype/src/agents/accrual-inputs.ts`
- Create: `Prototype/src/agents/accrual-inputs.test.ts`

**Step 1:** Define input type — **strings/dates only, no numbers** (type-enforced seam)

```ts
export interface AccrualInputs {
  fee_schedule_description: string;      // e.g., "$120,000 annually, billed quarterly"
  total_fee_amount: string;              // string representation — parsed in accrual-math
  currency: string;
  service_start_date: string;            // ISO
  service_end_date: string;              // ISO
  billing_frequency: "monthly" | "quarterly" | "annual" | "milestone" | "other";
  missing: string[];                     // fields the LLM couldn't confidently extract
}
```

**Step 2:** TDD — mock Ollama, verify schema

**Step 3:** Implement extraction from contract text + already-extracted attributes

**Step 4:** Run tests — expect pass

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(agents): UC-10 accrual inputs extraction (strings/dates only)"
```

---

### Task 4.2: Deterministic accrual math

**Files:**
- Create: `Prototype/src/lib/accrual-math.ts`
- Create: `Prototype/src/lib/accrual-math.test.ts`

**Step 1:** Write comprehensive TDD for straight-line accrual

```ts
import { describe, it, expect } from "vitest";
import { calculateAccrual, parseCurrency } from "./accrual-math";

describe("parseCurrency", () => {
  it("parses common formats", () => {
    expect(parseCurrency("$120,000.00")).toBe(120000);
    expect(parseCurrency("USD 1,500")).toBe(1500);
    expect(parseCurrency("$4.2M")).toBe(4_200_000);
  });
});

describe("calculateAccrual — straight line", () => {
  it("pro-rates monthly for annual contract", () => {
    const result = calculateAccrual({
      totalFee: 120000,
      serviceStart: new Date("2026-01-01"),
      serviceEnd: new Date("2026-12-31"),
      periodEnd: new Date("2026-04-30"),
      method: "straight-line",
      billedToDate: 0,
    });
    expect(result.periodAccrual).toBe(40000); // 4 months × $10k
    expect(result.accruedCumulative).toBe(40000);
  });
  it("nets against billed-to-date (GR/IR awareness)", () => {
    const result = calculateAccrual({
      totalFee: 120000,
      serviceStart: new Date("2026-01-01"),
      serviceEnd: new Date("2026-12-31"),
      periodEnd: new Date("2026-04-30"),
      method: "straight-line",
      billedToDate: 30000,
    });
    expect(result.periodAccrual).toBe(10000); // 40k earned - 30k billed
  });
  it("handles zero-period (nothing earned yet)", () => {
    const result = calculateAccrual({
      totalFee: 120000,
      serviceStart: new Date("2026-06-01"),
      serviceEnd: new Date("2026-12-31"),
      periodEnd: new Date("2026-04-30"),
      method: "straight-line",
      billedToDate: 0,
    });
    expect(result.periodAccrual).toBe(0);
  });
});
```

**Step 2:** Run — expect fail

**Step 3:** Implement `calculateAccrual`, `parseCurrency`, helpers — **pure TypeScript, no LLM**

```ts
export interface AccrualCalcInput {
  totalFee: number;              // dollars
  serviceStart: Date;
  serviceEnd: Date;
  periodEnd: Date;               // close date
  method: "straight-line" | "immediate" | "direct-association";
  billedToDate: number;          // dollars paid/invoiced already (proxy for GR/IR)
}
export interface AccrualCalcResult {
  periodAccrual: number;         // dollars to accrue this period
  accruedCumulative: number;     // cumulative earned through periodEnd
  reasoning: string;             // human-readable calc detail
}
```

**Step 4:** Run tests — expect all pass

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(lib): deterministic accrual math (TDD, type-enforced no-LLM-numbers)"
```

---

### Task 4.3: JE builder

**Files:**
- Create: `Prototype/src/lib/je-builder.ts`
- Create: `Prototype/src/lib/je-builder.test.ts`

**Step 1:** Types

```ts
export interface JELine { account: string; accountName: string; debit: number; credit: number; }
export interface ProposedJE {
  id: string;
  period: string;                 // "2026-04"
  description: string;
  lines: JELine[];                // total debits = total credits
  reversalDate: Date;
  supportingCalc: string;
  contractId: string;
  contractClauseRefs: { field: string; page: number | null }[];
}
```

**Step 2:** TDD — total debits = total credits, reversal date is 1st of next month, two-line entry (DR Expense, CR Accrued Liability)

**Step 3:** Implement `buildAccrualJE(inputs, calcResult, contract)`

**Step 4:** Run tests — expect pass

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(lib): proposed JE builder for accruals"
```

---

### Task 4.4: Accrual agent orchestration

**Files:**
- Create: `Prototype/src/agents/accrual.ts`
- Modify: `Prototype/src/adapters/agent-interface.ts` (add `calculateAccrual`)
- Modify: `Prototype/src/adapters/live-agent.ts`

**Step 1:** `agents/accrual.ts` — coordinates: call `accrual-inputs` extractor → parse amounts to numbers → call `accrual-math` → call `je-builder` → return `ProposedJE`

**Step 2:** If inputs.missing is non-empty, throw with descriptive error (caught by UI)

**Step 3:** Wire through LiveAgent with event emission

**Step 4:** Commit

```powershell
git add .
git commit -m "feat(agents): UC-10 accrual agent (extract → math → JE)"
```

---

### Task 4.5: Accrual proposal screen

**Files:**
- Create: `Prototype/src/components/JECard.tsx`
- Create: `Prototype/src/components/CalcDetailPanel.tsx`
- Rewrite: `Prototype/src/screens/AccrualProposal.tsx`
- Modify: `Prototype/src/screens/ContractReview.tsx` (add "Propose Accrual" button → navigate)

**Step 1:** `JECard` — two-column T-account visual, debits/credits, totals footer, reversal date, approve/reject buttons

**Step 2:** `CalcDetailPanel` — shows extracted inputs + math reasoning string + clause references (clickable → jumps to PDF page)

**Step 3:** `AccrualProposal` screen — on mount calls `agent.calculateAccrual(contract)`; shows agent strip + calc panel + JE card; Approve → toast + close-store event

**Step 4:** Error state — if missing inputs, render missing-fields checklist instead of JE

**Step 5:** Manual test end-to-end with real contract

**Step 6:** Commit

```powershell
git add .
git commit -m "feat(accrual): UC-10 accrual proposal screen with JE card"
```

---

### Task 4.6: Demo-alignment pass — Auto playback + Behind-the-Scenes

**Files:**
- Modify: `Prototype/src/screens/ContractReview.tsx` (add Auto/Manual toggle)
- Modify: `Prototype/src/components/AgentActivityStrip.tsx` (clickable steps → modal)
- Create: `Prototype/src/components/BehindTheScenesModal.tsx`
- Create: `Prototype/src/data/agent-step-narratives.ts`

**Step 1:** `BehindTheScenesModal` — opens when a step in the strip is clicked. Shows: **Actions** (what the agent did), **Systems Involved** (SAP, BlackLine, Foundry, etc.), **Outputs** (schema of what this step produced), **Handoff To** (next step or human).

**Step 2:** `agent-step-narratives.ts` — 8 step entries matching the Demo Experience Guide's Step 1–8 descriptions for Contract Review scenario (Initiate Scan → Ingest → Extract 27 attrs → Flag ASC 842/815/350 → Risk-Rank → Deliver → Marcus Validate → Rachel Approve).

**Step 3:** `ContractReview.tsx` Auto mode — toggle next to upload. When Auto is on, the screen paces agent calls with 15–25 second dwells per step (targeting the guide's 3-minute total). Green pulse animation on the active step matches the guide's visual language.

**Step 4:** Manual test — run full Contract Review in Auto mode, time end-to-end. Adjust dwells to land between 2:45 and 3:15.

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(demo): Auto playback + Behind-the-Scenes modal for Demo Moment 2"
```

---

### Task 4.7: Phase 4 checkpoint

```powershell
git tag ps-04-uc10
```

---

## Phase 5 — Narrative Agent: Variance Commentary & Executive Summary (PS-05-Narr)

*This phase adds a 3rd user-facing real-AI agent distinct from contract review and JE: an LLM-driven narrative generator for variance commentary and executive close summaries (UC-18 + UC-20).*

### Task 5.1: Seed P&L data

**Files:**
- Create: `Prototype/src/data/seed-pnl.ts`

**Step 1:** Build a realistic synthetic P&L dataset: 12–15 line items (Revenue, COGS, Marketing, G&A, R&D, Store Ops, D&A, Interest, Tax, etc.), with current period + prior period values, variance $ and %, entity split (NA/EMEA/GC/APLA), and a "drivers" string per line item (mix/volume/price/FX notes). Must be rich enough that Qwen can ground commentary in real numbers, not hallucinate.

```ts
export interface PnLLine {
  id: string;
  lineItem: string;
  category: "Revenue" | "COGS" | "Opex" | "Below-Line";
  currentPeriod: number;
  priorPeriod: number;
  variance: number;          // dollars
  variancePct: number;       // percent
  driver: string;            // e.g., "Volume +4%; FX -2%; Mix +1%"
  entitySplit: Record<"NA" | "EMEA" | "GC" | "APLA", number>;
}

export const seedPnL: PnLLine[] = [
  { id: "rev-direct", lineItem: "Direct-to-Consumer Revenue", category: "Revenue",
    currentPeriod: 2_845_000_000, priorPeriod: 2_710_000_000,
    variance: 135_000_000, variancePct: 5.0,
    driver: "Volume +3%; Price +2%; Mix +0.5%; FX -0.5%",
    entitySplit: { NA: 1_280_000_000, EMEA: 720_000_000, GC: 515_000_000, APLA: 330_000_000 } },
  // ... 11–14 more line items
];
```

**Step 2:** Commit

```powershell
git add src/data/seed-pnl.ts
git commit -m "feat(data): seed P&L dataset for narrative agent"
```

---

### Task 5.2: Narrative agent — variance commentary

**Files:**
- Create: `Prototype/src/agents/narrative.ts`
- Create: `Prototype/src/agents/narrative.test.ts`

**Step 1:** Write failing test with mocked Ollama

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("./ollama-client");
import { chatJSON } from "./ollama-client";
import { generateVarianceCommentary } from "./narrative";

describe("generateVarianceCommentary", () => {
  it("returns structured commentary per line item", async () => {
    (chatJSON as any).mockResolvedValue({
      commentary: "DTC revenue grew $135M (+5%) driven by volume and price.",
      key_drivers: ["Volume +3%", "Price +2%"],
      risk_flags: [],
      confidence: 0.85,
    });
    const result = await generateVarianceCommentary({
      id: "rev-direct", lineItem: "Direct-to-Consumer Revenue",
      currentPeriod: 2_845_000_000, priorPeriod: 2_710_000_000,
      variance: 135_000_000, variancePct: 5.0, driver: "Volume +3%; Price +2%",
    } as any);
    expect(result.commentary).toContain("DTC");
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
```

**Step 2:** Run — expect fail

**Step 3:** Implement

```ts
import { chatJSON } from "./ollama-client";
import type { PnLLine } from "@/data/seed-pnl";

export interface VarianceCommentary {
  commentary: string;          // 2–3 sentence prose
  key_drivers: string[];       // bulleted driver list
  risk_flags: string[];        // potential disclosure risks
  confidence: number;          // 0..1
}

const SYSTEM = `You are a senior financial analyst writing for a Fortune 500 controller. Produce concise, factual variance commentary grounded ONLY in the numbers provided. Never fabricate figures. Match CFO-memo tone: precise, neutral, 2-3 sentences max. Flag anything that could require disclosure (e.g., one-time items, material FX impact).`;

export async function generateVarianceCommentary(line: PnLLine): Promise<VarianceCommentary> {
  const prompt = `Line item: ${line.lineItem}
Current period: $${line.currentPeriod.toLocaleString()}
Prior period: $${line.priorPeriod.toLocaleString()}
Variance: $${line.variance.toLocaleString()} (${line.variancePct.toFixed(1)}%)
Known drivers: ${line.driver}

Generate variance commentary.`;

  const schemaHint = `{
  "commentary": "string — 2-3 sentences of prose",
  "key_drivers": ["string", ...],
  "risk_flags": ["string", ...],
  "confidence": 0..1
}`;

  return chatJSON<VarianceCommentary>({ system: SYSTEM, prompt, schemaHint, temperature: 0.2 });
}
```

**Step 4:** Run tests — expect pass

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(agents): UC-18 variance commentary agent"
```

---

### Task 5.3: Narrative agent — executive close summary

**Files:**
- Modify: `Prototype/src/agents/narrative.ts` (add function)
- Modify: `Prototype/src/agents/narrative.test.ts` (add test)

**Step 1:** Write failing test

```ts
describe("generateExecutiveSummary", () => {
  it("produces board-ready narrative", async () => {
    (chatJSON as any).mockResolvedValue({
      headline: "Q2 close completed in 5.2 days vs 8-day target...",
      key_highlights: ["DTC revenue +5%", "Gross margin flat"],
      risks: ["China APLA FX exposure"],
      recommendation: "Proceed to consolidation.",
    });
    const r = await generateExecutiveSummary({ closeDays: 5.2, autoCertRate: 0.82, keyVariances: [], risks: [] });
    expect(r.headline).toBeTruthy();
  });
});
```

**Step 2:** Implement `generateExecutiveSummary` — inputs are close metrics + top 3 variances + top risks; output is a structured exec narrative (headline, highlights, risks, recommendation).

**Step 3:** Run tests — expect pass

**Step 4:** Commit

```powershell
git add .
git commit -m "feat(agents): UC-20 executive close narrative agent"
```

---

### Task 5.4: Agent adapter — narrative methods

**Files:**
- Modify: `Prototype/src/adapters/agent-interface.ts` (add `generateVarianceCommentary`, `generateExecutiveSummary` to interface + events)
- Modify: `Prototype/src/adapters/live-agent.ts` (wire through)

**Step 1:** Add narrative methods to Agent interface, update AgentEvent step types: `"narrative-variance" | "narrative-exec"`

**Step 2:** Implement in LiveAgent with event emission

**Step 3:** Commit

```powershell
git add .
git commit -m "feat(adapters): narrative methods on Agent interface"
```

---

### Task 5.5: Narrative screen — variance commentary

**Files:**
- Create: `Prototype/src/screens/Narrative.tsx`
- Create: `Prototype/src/components/VarianceTable.tsx`
- Create: `Prototype/src/components/CommentaryPanel.tsx`
- Modify: `Prototype/src/App.tsx` (add `/narrative` route)
- Modify: `Prototype/src/components/Layout.tsx` (add Narrative nav link)

**Step 1:** `VarianceTable` — renders seed P&L with columns: Line Item, Current, Prior, Variance $, Variance %, Action (Generate commentary). Supports "Generate all" batch button.

**Step 2:** `CommentaryPanel` — right-side panel showing:
- Selected line item details
- Generated commentary (with streaming-style appearance for live mode)
- Key drivers list
- Risk flags (amber chips)
- Copy-to-clipboard + Accept/Edit buttons

**Step 3:** `Narrative` screen — combines VarianceTable + CommentaryPanel; on click row → call `agent.generateVarianceCommentary(line)` → render result

**Step 4:** Add `/narrative` route + "Narrative" nav link

**Step 5:** Manual test with live Qwen — generate commentary for 3 line items, verify grounding (no hallucinated numbers)

**Step 6:** Commit

```powershell
git add .
git commit -m "feat(narrative): UC-18 variance commentary screen"
```

---

### Task 5.6: Executive summary tab + Close Cockpit integration

**Files:**
- Modify: `Prototype/src/screens/Narrative.tsx` (add "Executive Summary" tab)
- Modify: `Prototype/src/screens/CloseCockpit.tsx` (add "Generate Close Narrative" action when phase reaches "Gate")
- Create: `Prototype/src/components/ExecSummaryCard.tsx`

**Step 1:** Narrative screen has two tabs: "Variance Commentary" | "Executive Summary"

**Step 2:** Exec Summary tab — one-click "Generate" reads close state + top variances + risks → calls `agent.generateExecutiveSummary()` → renders formatted card (headline + highlights + risks + recommendation) with print/copy button

**Step 3:** Close Cockpit — when `activePhase === "gate"`, show "Generate Close Narrative" button that navigates to `/narrative?tab=exec&autorun=true`

**Step 4:** Manual test — run close sim to Gate phase, click button, verify narrative generates

**Step 5:** Commit

```powershell
git add .
git commit -m "feat(narrative): UC-20 executive close summary + cockpit integration"
```

---

### Task 5.7: Phase 5 checkpoint

**Step 1:** Full manual test — upload contract (from Phase 2–4), run close sim (Phase 1), generate variance commentary + exec narrative. Verify all 3 agent flows work end-to-end.

**Step 2:** Tag

```powershell
git tag ps-05-narrative
```

---

## Phase 6 — Canned Mode + Acme Theme + GitHub Pages (PS-06)

### Task 6.1: Fixture format + CannedAgent

**Files:**
- Create: `Prototype/src/adapters/canned-agent.ts`
- Create: `Prototype/src/adapters/canned-agent.test.ts`
- Create: `Prototype/fixtures/.gitkeep`
- Modify: `Prototype/src/adapters/index.ts`

**Step 1:** Define fixture format

```ts
// fixtures/<hash>.json
{
  "contractId": "acme-001",
  "attributes": { /* ContractAttributes */ },
  "risk": { /* RiskResult */ },
  "techAcct": { /* TechAccountingFlags */ },
  "accrualInputs": { /* AccrualInputs */ },
  "proposedJE": { /* ProposedJE */ }
}
```

**Step 2:** TDD — CannedAgent loads fixture by hash and returns cached values with artificial delay

```ts
it("throws when hash is unknown", async () => { /* ... */ });
it("emits step events with timing", async () => { /* ... */ });
```

**Step 3:** Implement — uses Vite glob import for fixtures:

```ts
const fixtures = import.meta.glob("/fixtures/*.json", { eager: true, import: "default" });
```

**Step 4:** Update adapters index to return CannedAgent when `MODE === "canned"`

**Step 5:** Run tests — expect pass

**Step 6:** Commit

```powershell
git add .
git commit -m "feat(adapters): CannedAgent replays JSON fixtures with timing"
```

---

### Task 6.2: Fixture generator script

**Files:**
- Create: `Prototype/src/scripts/generate-fixtures.ts`
- Create: `Prototype/samples/acme/.gitkeep`

**Step 1:** Script walks `samples/acme/*.pdf`, reads each via `extractPdfText`, runs LiveAgent chain, writes `fixtures/<hash>.json`

**Step 2:** Uses node-fetch for Ollama calls (Node context, no `window.crypto`)

**Step 3:** Logs progress; fails loudly on any agent error so fixtures are never partially bad

**Step 4:** Commit

```powershell
git add .
git commit -m "feat(scripts): fixture generator for canned mode"
```

---

### Task 6.3: Verify sample contracts in place

**Files (already present — do NOT regenerate):**
- `Prototype/samples/acme/Contract_1_Advertising_Campaign.docx`
- `Prototype/samples/acme/Contract_2_Professional_Services_Outsourcing.docx`
- `Prototype/samples/acme/Contract_3_Insurance_MultiYear.docx`
- `Prototype/samples/acme/Contract_4_Construction_Retail_Remodel.docx`
- `Prototype/samples/acme/Contract_5_AWS_Enterprise.docx`
- Create: `Prototype/samples/README.md`

**Step 1:** Confirm all 5 contracts present in `samples/acme/`. These are the canonical public-safe samples for the Acme Pages demo. Do NOT replace or rename them — they are the golden inputs for fixture generation and regression tests.

**Step 2:** The contracts are `.docx` not `.pdf`. Ensure the ingest layer (Task 1.10) supports both formats — add `mammoth` dependency for `.docx` text extraction alongside `pdfjs-dist` for PDFs. The ingest utility should detect file extension and route accordingly, returning the same `ExtractedPdf`-shaped result (rename type to `ExtractedDocument` if desired).

**Step 2:** `samples/README.md` — how to add new samples, how to regenerate fixtures

**Step 3:** Commit

```powershell
git add .
git commit -m "chore(samples): 4 Acme Co sample contracts"
```

---

### Task 6.4: Generate canned fixtures

**Step 1:** Run

```powershell
pnpm generate-fixtures
```

(Requires Ollama running with qwen2.5:7b pulled.)

**Step 2:** Verify `fixtures/` now has 4 JSON files

**Step 3:** Smoke test canned mode

```powershell
pnpm dev:canned
```

Acme theme loads, ModeBanner amber, upload a sample contract — all 4 agents replay their fixture output with step-timing animation.

**Step 4:** Commit fixtures

```powershell
git add fixtures/
git commit -m "chore(fixtures): generate canned outputs for Acme samples"
```

---

### Task 6.5: GitHub Pages workflow

**Files:**
- Create: `Prototype/.github/workflows/pages.yml`

**Step 1:** Write workflow

```yaml
name: Deploy Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:pages
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Step 2:** Verify `vite.config.ts` uses `--base=/nike-r2r-demo/` in pages build (already configured in Task 1.4)

**Step 3:** Commit

```powershell
git add .github/workflows/pages.yml
git commit -m "ci: GitHub Pages deployment workflow"
```

---

### Task 6.6: Push to GitHub + verify Pages deployment

**Step 1:** Confirm GitHub repo name/owner with Keven

**Step 2:** Create repo on GitHub (private to start, flip to public for Pages when ready)

**Step 3:** Push

```powershell
git remote add origin git@github.com:<owner>/nike-r2r-demo.git
git push -u origin main
```

**Step 4:** In repo Settings → Pages, enable "GitHub Actions" as source

**Step 5:** Watch Actions tab, wait for deploy, visit `https://<owner>.github.io/nike-r2r-demo/`

**Step 6:** Verify Acme theme, upload a sample → full chain runs from fixtures

---

### Task 6.7: Phase 6 checkpoint

```powershell
git tag ps-06-canned-pages
```

---

## Phase 7 — Packaging, Tests, Documentation (PS-Final)

### Task 7.1: Full README

**Files:**
- Rewrite: `Prototype/README.md`

**Step 1:** Cover:
- What this is (NOAH reference demo)
- Two modes (live Nike / canned Acme)
- Quick start — Nike mode (Windows PowerShell)
- Quick start — Acme Pages URL
- Adding your own contracts
- Regenerating fixtures
- 60-second demo script (suggested click-through)
- Troubleshooting (Ollama not running, scanned PDFs)

**Step 2:** Commit

```powershell
git add README.md
git commit -m "docs: complete README with setup, demo script, troubleshooting"
```

---

### Task 7.2: Prompt regression harness

**Files:**
- Create: `Prototype/src/scripts/prompt-regression.ts`
- Create: `Prototype/tests/golden/Contract_1_Advertising_Campaign.expected.json` (and 4 more, one per sample)

**Step 1:** Script — for each Acme sample, run LiveAgent, compare `{counterparty, tcv, service_start_date, service_end_date}` against golden file

**Step 2:** Exit 1 on mismatch, print diff

**Step 3:** Commit

```powershell
git add .
git commit -m "test: prompt regression harness for Acme samples"
```

---

### Task 7.3: Playwright E2E (canned mode)

**Files:**
- Create: `Prototype/playwright.config.ts`
- Create: `Prototype/tests/e2e/contract-flow.spec.ts`

**Step 1:** Configure Playwright against dev:canned

**Step 2:** Test — navigate → upload Contract_1_Advertising_Campaign.docx → assert agent strip reaches "done" → assert attribute checklist renders → click Propose Accrual → assert JE card shows specific expected amount

**Step 3:** Run

```powershell
pnpm test:e2e
```

**Step 4:** Commit

```powershell
git add .
git commit -m "test(e2e): contract-flow playwright smoke test"
```

---

### Task 7.4: Pre-commit guard for Deloitte PDFs

**Files:**
- Create: `Prototype/.husky/pre-commit`
- Modify: `Prototype/package.json` (husky install)

**Step 1:** Install husky

```powershell
pnpm add -D husky
pnpm exec husky init
```

**Step 2:** Pre-commit hook rejects staged files in `samples/user/` that aren't `.gitkeep`

```bash
#!/usr/bin/env bash
FILES=$(git diff --cached --name-only | grep -E '^samples/user/' | grep -v '\.gitkeep$' || true)
if [ -n "$FILES" ]; then
  echo "ERROR: Attempted to commit Deloitte contracts:"
  echo "$FILES"
  echo "These files must never be committed. Move them out of samples/user/ or unstage them."
  exit 1
fi
```

**Step 3:** Test — drop a test PDF in samples/user/, `git add`, `git commit` → expect rejection

**Step 4:** Commit hook itself

```powershell
git add .husky/pre-commit package.json
git commit -m "chore: pre-commit hook blocking Deloitte contract commits"
```

---

### Task 7.5: Dress rehearsal

**Step 1:** Fresh machine test — clone repo, follow README exactly, time setup (should be <5 min)

**Step 2:** Run full demo script:
1. Open Close Cockpit, start simulation, talk through agents as phases advance
2. Open Copilot, ask "close status" and "exceptions"
3. Open Contracts, upload a Deloitte contract (live mode)
4. Walk through agent strip → attributes → risk → tech-acct
5. Click Propose Accrual → walk through math → approve
6. Return to Close Cockpit — verify audit event appears in log

**Step 3:** Same drill on Pages URL with Acme contracts

**Step 4:** Note any rough edges; fix and re-test

**Step 5:** Final commit + tag

```powershell
git add .
git commit -m "chore: dress rehearsal polish"
git tag v0.1.0
git push --tags
```

---

## Definition of Done — Verified

- [ ] `pnpm dev` runs on a fresh Windows laptop in <5 min setup
- [ ] Upload a Deloitte contract → agent strip animates → attributes render → risk + ASC flags → proposed JE with deterministic math
- [ ] GitHub Pages URL loads Acme demo; 4 contracts walk through contract→JE end-to-end
- [ ] `git log --all -- samples/user/` shows no PDFs (verified)
- [ ] `pnpm test:prompts` passes on all 4 Acme samples
- [ ] `pnpm test` and `pnpm test:e2e` both green
- [ ] README has both setup paths + a 60-second demo script

---

## Notes for the implementing engineer

- **Never let the LLM produce JE dollar amounts.** Types enforce this — if you find yourself casting an LLM output to `number` for a JE line, stop and extract the underlying string/date terms instead.
- **Fixtures drift when prompts change.** After any prompt edit, rerun `pnpm generate-fixtures` or the Pages demo will be stale.
- **The Copilot panel is scripted on purpose.** Do not try to make it real — that's a different use case (UC-25/26) not in this prototype's scope.
- **Deloitte samples are sacred.** Any mistake that commits a PDF from `samples/user/` is a real problem. The gitignore + pre-commit hook are belt+suspenders; be careful with `git add -A`.
