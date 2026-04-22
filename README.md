# NOAH Prototype — Nike Agentic R2R Reference Demo

A React + Express + Postgres prototype that executes the NOAH R2R demo end-to-end with **three real-AI agent flows** running on local Ollama (Qwen 2.5 + nomic-embed-text):

1. **Contract Review** — 27-attribute extraction, risk scoring (rules + LLM), ASC 840/842/815 classification
2. **Accrual & JE** — fee-schedule extraction → deterministic TypeScript math → proposed journal entry
3. **Narrative** — variance commentary per P&L line + executive close narrative

Plus a **scripted close-cycle simulation** and **canned Acme public demo** deployed to GitHub Pages.

## Two modes

| Mode | What it's for | Stack | Setup |
|---|---|---|---|
| **Live (Nike theme)** | Internal demo on your laptop; real Qwen extraction against your contracts | React + Express + Postgres + Ollama | ~5 min, one-time |
| **Canned (Acme theme)** | Public/shareable link; pre-baked agent outputs | React static bundle only | Zero — visit the Pages URL |

---

## Quick start — Live (Nike) mode

### One-time

```powershell
winget install pnpm
winget install Ollama.Ollama
winget install Docker.DockerDesktop
ollama pull qwen2.5:7b          # ~5 GB
ollama pull nomic-embed-text    # ~275 MB
```

### Each run

```powershell
cd Prototype
docker compose up -d postgres   # Postgres 16 + pgvector on :5434
cd server
cp .env.example .env
pnpm install
pnpm dev &                      # Express on :3001
cd ..
cp .env.example .env
pnpm install
pnpm dev                        # Vite on :5173
```

### First-time seed

```powershell
cd server && pnpm seed          # ingest 5 Acme contracts + generate embeddings
```

Open http://localhost:5173 — you should see the Nike theme with 5 contracts listed.

### Optional admin UI (Adminer)

```powershell
docker compose --profile tools up -d adminer
# http://localhost:8081 · System: PostgreSQL · Server: postgres · User/Pass: noah · DB: noah
```

---

## Quick start — Canned (Acme) Pages demo

Visit the public URL (set by your GitHub Pages deployment). No setup required — all agent outputs are pre-baked into the bundle.

To build and serve locally:

```powershell
pnpm build:pages
npx serve dist   # or any static file server
```

---

## 60-second demo script

Open the app. Press `Ctrl+Shift+D` to toggle the ModeBanner if distracting.

**0:00–0:15 — Close Cockpit**
- Land on `/`. Click **Start** — narrate the 4 phases (Pre-Close → Execute → Validate → Gate) animating through 6 entities with an event log.

**0:15–0:35 — Contract Review (Demo Moment 2)**
- Click **Contracts**. Open **Contract_1_Advertising_Campaign.docx** (Wieden+Kennedy $8.4M MSA).
- Click **Run full chain**. The Agent Activity Strip animates Extract → Risk → Tech-Acct. Click any step for the **Behind the Scenes** modal (Actions / Systems / Outputs / Handoff).
- Point to: risk score, no-liability-cap flag, no lease flagged (vs. AWS contract).

**0:35–0:45 — Proposed Accrual (Demo Moment 3)**
- Click **→ Accrual**. The JE card shows DR 6810 Services Expense / CR 2310 Accrued Liability, both **$350,000**. Supporting calc details the straight-line math.
- Click **Approve**. Toast + audit event written to Close Cockpit event log.

**0:45–1:00 — Narrative (Demo Moment 4)**
- Click **Narrative** → **Variance Commentary** tab. Click **Generate** on DTC Revenue. Commentary populates: prose grounded in $135M / +5.0% numbers with key drivers.
- Switch to **Executive Summary** tab. Click **Generate**. Board-ready headline + highlights + risks + recommendation.

---

## Three agents ↔ demo moments map

| Demo Moment | Slide | Duration | What the prototype does |
|---|---|---|---|
| 1 — Problem in motion | 4→5 | 60s | (served by Journey HTML app, not this prototype) |
| **2 — The New Way, Live** | 7 | 3 min | **ContractReview auto-play + Behind-the-Scenes** |
| 3 — Proof in the Workflow | 9 | 2 min | **AccrualProposal one-click JE approval** |
| **4 — The Executive View** | 10 | 90s | **Narrative Exec Summary** (triggered at Gate phase) |

---

## Adding your own contracts

Drop `.pdf` or `.docx` files into `samples/user/` — this folder is **gitignored**.

Upload via the Contract Queue UI (live mode only). The server extracts text, generates a 768-dim embedding, stores the blob + metabase row, and writes an audit event.

For the public Acme demo, add to `samples/acme/` + regenerate fixtures:

```powershell
cd server
pnpm seed                                        # ingests the new file
pnpm tsx src/scripts/generate-fixtures.ts        # ~25-30 min on CPU Qwen
# Review fixtures/metabase.json.generated, rename to metabase.json, commit
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  React SPA (Vite + TS + Tailwind)                                        │
│    screens: CloseCockpit · ContractQueue · ContractReview ·              │
│             AccrualProposal · Narrative · CopilotPanel                   │
│    agents: extractor · risk · tech-accounting · accrual · narrative      │
│    adapters: LiveAgent | CannedAgent (switched by VITE_MODE)             │
└──────────┬────────────────────────────────┬──────────────────────────────┘
           │ HTTP (fetch)                   │ HTTP (fetch)
           ▼                                ▼
┌───────────────────────┐      ┌────────────────────────────────────────┐
│  Ollama (localhost    │      │  Server (Node/Express + TypeScript)    │
│  :11434)              │      │    /api/contracts · /api/metabase      │
│   • qwen2.5:7b        │      │    /api/search    · /api/audit         │
│   • nomic-embed-text  │      │   server-side ingest (pdf-parse +      │
└───────────────────────┘      │     mammoth) + embeddings              │
                               └──────────┬─────────────────────────────┘
                                          │
                                          ▼
                               ┌────────────────────────────────────────┐
                               │  PostgreSQL 16 + pgvector (Docker)     │
                               │    contracts       — bytea blobs       │
                               │    contract_metabase — JSONB + vec(768)│
                               │    audit_events    — SOX trail         │
                               │    pnl_lines       — narrative seed    │
                               └────────────────────────────────────────┘
```

Pages (canned) mode bypasses the backend entirely — pre-baked fixtures ship in the bundle.

---

## Repo layout

```
Prototype/
├── README.md                    (this file)
├── DESIGN.md                    approved design doc
├── PLAN.md                      task-level implementation plan
├── roadmap.md                   backlog BL.01–BL.46
├── orchestrator.md              acceptance matrix + UAT scripts
├── package.json                 frontend
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── .env.example
├── .gitignore                   (gitignores samples/user/**)
├── docker-compose.yml           Postgres + pgvector + Adminer
├── docker/
│   └── init.sql                 schema + HNSW index + trigger
├── server/                      Node/Express backend
│   ├── package.json
│   ├── src/
│   │   ├── index.ts             Express app
│   │   ├── db.ts                pg pool + pgvector registration
│   │   ├── lib/
│   │   │   ├── ingest.ts        pdf-parse + mammoth
│   │   │   └── embeddings.ts    Ollama nomic-embed-text
│   │   ├── routes/
│   │   │   ├── contracts.ts
│   │   │   ├── metabase.ts
│   │   │   ├── search.ts
│   │   │   └── audit.ts
│   │   └── scripts/
│   │       ├── seed-samples.ts
│   │       ├── smoke-extract.ts
│   │       ├── generate-fixtures.ts
│   │       └── prompt-regression.ts
│   └── README.md
├── src/                         frontend
│   ├── main.tsx · App.tsx · index.css
│   ├── config/env.ts            VITE_MODE + URL config
│   ├── theme/                   nike.ts · acme.ts · index.ts
│   ├── agents/                  extractor · risk · tech-accounting · accrual-inputs · accrual · narrative · ollama-client · contract-schema
│   ├── adapters/                agent-interface · live-agent · canned-agent · index
│   ├── components/              AgentActivityStrip · AttributeChecklist · BehindTheScenesModal · CalcDetailPanel · CommentaryPanel · ConfidenceBadge · EntityList · EventLog · ExecSummaryCard · JECard · Layout · ModeBanner · OllamaGuard · PhaseGrid · RiskPanel · TechAccountingFlags · VarianceTable
│   ├── screens/                 CloseCockpit · ContractQueue · ContractReview · AccrualProposal · Narrative · CopilotPanel
│   ├── store/closeStore.ts      zustand
│   ├── data/                    seed-pnl · copilot-canned-answers · agent-step-narratives
│   └── lib/                     api-client · fixtures · accrual-math · je-builder
├── samples/
│   ├── acme/                    committed public contracts
│   ├── user/                    gitignored (your own contracts)
│   └── README.md
├── fixtures/                    pre-baked canned-mode outputs
│   ├── metabase.json
│   └── narratives.json
├── tests/
│   └── e2e/                     Playwright
├── .husky/
│   └── pre-commit               blocks samples/user/ commits
└── .github/workflows/
    └── pages.yml                deploy Acme canned build
```

---

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Vite dev on :5173 (live mode, Nike theme) |
| `pnpm dev:canned` | Vite dev in canned mode (Acme theme, fixtures) |
| `pnpm build` | Production build (live mode) |
| `pnpm build:pages` | Pages build (canned mode, `/nike-r2r-demo/` base path) |
| `pnpm preview` | Preview the production build locally |
| `pnpm lint` | TypeScript type-check (no emit) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | Playwright E2E (canned mode) |
| `pnpm db:up` / `db:down` / `db:reset` | Postgres lifecycle |
| `pnpm server:dev` | Proxy to `cd server && pnpm dev` |

From `server/`:

| Script | Purpose |
|---|---|
| `pnpm dev` | tsx watch — Express on :3001 |
| `pnpm seed` | Ingest `samples/acme/` into Postgres with embeddings |
| `pnpm tsx src/scripts/smoke-extract.ts Contract_1_Advertising_Campaign.docx` | Verify the Qwen extractor pipeline end-to-end |
| `pnpm tsx src/scripts/generate-fixtures.ts` | Regenerate `fixtures/metabase.json.generated` |
| `pnpm tsx src/scripts/prompt-regression.ts` | Run LiveAgent against the golden set and diff |

---

## Guardrails (type-enforced or hook-enforced)

| Guardrail | How it's enforced |
|---|---|
| **LLM cannot produce JE dollar amounts** | `AccrualInputs` has zero numeric fields; `parseCurrency`/`parseDate` convert strings in TS; JE builder throws if debits ≠ credits |
| **Narrative prompts forbid fabricated numbers** | System prompt rule; prompt-regression harness checks output for numeric tokens not in input |
| **Deloitte PDFs never reach git** | `.gitignore` on `samples/user/**` + husky pre-commit hook rejects staged files in that path |
| **Ollama availability** | `OllamaGuard` component blocks `/contracts` + `/narrative` routes with a modal until `/api/tags` responds |
| **ModeBanner visibility** | Dev-only (`import.meta.env.PROD` guard); `Ctrl+Shift+D` toggles for clean demo |

---

## Troubleshooting

| Symptom | Likely cause · Fix |
|---|---|
| "Ollama unreachable" modal | Ollama not running. `ollama serve` or start Ollama Desktop. |
| "Cannot compute — missing inputs" on Accrual | Extractor didn't populate service dates. Re-run extraction; if still missing, the contract doesn't have the required fields. |
| Contract text < 200 chars | Scanned PDF. OCR not included in prototype — use a text-based PDF or convert first. |
| Extraction takes 5+ minutes | Normal on CPU-only Qwen 7B. AgentActivityStrip shows spinner throughout. For Pages demo, fixtures are pre-baked and instant. |
| Semantic search returns `[]` | With only 5 rows and ivfflat index, the index may under-return. The prototype uses HNSW — verify `docker/init.sql` applied: `\d contract_metabase` should show `idx_metabase_embedding hnsw`. |
| "Upload disabled" in canned mode | Expected — Pages deployment is read-only. Run `pnpm dev` locally to upload. |
| Build error: `Cannot find module 'zod'` / `undici` | Run `pnpm install` in both the root AND `server/`. |

---

## Documentation

- [DESIGN.md](./DESIGN.md) — approved design decisions, data flow, repo layout
- [PLAN.md](./PLAN.md) — task-level implementation plan (the plan this prototype was built from)
- [roadmap.md](./roadmap.md) — backlog BL.01–BL.46, progress snapshot
- [orchestrator.md](./orchestrator.md) — UC coverage matrix, UAT scripts, acceptance sign-off log
- [samples/README.md](./samples/README.md) — how to add contract samples
- [server/README.md](./server/README.md) — API reference

---

## License

Internal Deloitte prototype. Not for external distribution.
