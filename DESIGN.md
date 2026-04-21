# NOAH Reference Demo Prototype — Design

**Date:** 2026-04-20 (rev 2026-04-21 — added Narrative Agent, swapped to user-supplied contracts, aligned to Demo Experience Guide)
**Project:** Nike Agentic R2R (NOAH) — FY27 Pipeline
**Author:** Keven Markham (design), Claude (co-author)
**Status:** Approved — ready for implementation plan
**Scope chosen:** Option 3 + Narrative (UC-07 → UC-10, plus UC-18 + UC-20) — contract intake through proposed accrual JE, plus LLM-driven variance commentary and executive close narrative.

**References:**
- Parent project: `r2r-agentic/PROJECT_SUMMARY.md`
- Use-case spec: `r2r-agentic/NOAH-Sprint-Plan.xlsx` (26 UCs, 4 personas)
- Demo playbook: **`r2r-agentic/NOAH_Demo_Experience_Guide.docx`** — 11-slide deck with 4 demo moments (60s / 3min / 2min / 90s = ~8 min total demo time woven into presentation)
- Visual fidelity reference: `r2r-agentic/NikeR2R-v4-Compare.html`, `nike-r2r-architecture.html`
- Companion journey/flow apps (not replaced by this prototype): `Nike-R2R-NOAH-Journey.html`, `NOAH-Flow-Walkthrough.html`

---

## Purpose

Build a downloadable React prototype that proves NOAH is not vaporware by executing the "shown demo" from the existing HTML artifacts (`NikeR2R-v4-Compare.html`, `nike-r2r-architecture.html`) while demonstrating three distinct real-AI agent flows:

1. **Contract Review** — upload contract → attribute extraction → risk scoring → technical accounting flags
2. **Accrual JE** — fee schedule/service date extraction → deterministic accrual math → proposed journal entry
3. **Narrative Generation** — seeded P&L data → variance commentary per line item + executive close narrative

Two runtime modes from one codebase:

- **Live (Nike theme):** Runs locally on a demo laptop. Real LLM calls to Ollama/Qwen 2.5. Deloitte contracts (gitignored) as primary samples.
- **Canned (Acme Co theme):** Deployed to GitHub Pages. Pre-recorded LLM outputs baked into the bundle. 5 supplied sample contracts. Shareable via link — no setup.

## Non-goals

- No real SAP, BlackLine, or Azure connections.
- No OCR (scanned PDFs out of scope).
- No production hardening, auth, or SOX-grade audit persistence.
- No Electron or Docker packaging — pnpm dev locally, static build for Pages.

## Scope — Use Cases made real

| Use Case | What's real | What's scripted |
|---|---|---|
| UC-07 | 27-attribute extraction via Qwen | — |
| UC-08 | Risk score (rules + LLM signals), ranked queue | Historical baselines (seeded) |
| UC-09 | ASC 840/842 lease + ASC 815 derivative + expense recognition method | — |
| UC-10 | Fee schedule/service date extraction; **deterministic** TypeScript accrual math | GR/IR "awareness" is seeded not wired |
| UC-18 | Variance commentary per P&L line item (Qwen, grounded in seeded data) | P&L data is seeded, not pulled from SAP |
| UC-20 | Executive close narrative (headline, highlights, risks, recommendation) | Close metrics come from scripted simulation |

Scripted/animated (ported from existing HTMLs): close-cycle simulation, 6-entity journey map, Copilot chat panel, dashboards.

## Alignment to the Demo Experience Guide

The Demo Experience Guide divides the NOAH demo into **four moments** across the 11-slide deck. This prototype specifically powers Moment 2 (the centerpiece) and Moment 4, with supporting contributions to Moment 3. Moments 1 and 4 remain served by the existing Journey and Flow HTML apps — this prototype does not replace them.

| Demo Moment | Slide | Duration | Primary artifact | Prototype's role |
|---|---|---|---|---|
| **1 — "The Problem in Motion"** | 4→5 | 60s | `Nike-R2R-NOAH-Journey.html` (Rachel's pain points) | None — existing HTML is primary. Prototype not used. |
| **2 — "The New Way, Live"** ⭐ | 7 | 3 min | **This prototype** — Contract Review auto-play | **Centerpiece.** The 8-step agent orchestration (Initiate Scan → Ingest → Extract 27 attrs → Flag ASC 842/815/350 → Risk-Rank → Deliver → Marcus validates → Rachel approves) runs as the Contract Review chain + AgentActivityStrip. Add an "Auto" playback mode that walks the chain autonomously with a pre-selected sample contract. |
| **3 — "Proof in the Workflow"** | 9 | 2 min | Marcus's day-in-the-life + one-click JE posting | Prototype's **AccrualProposal screen** provides the one-click JE posting UX the guide describes. Opens from within Journey HTML or directly. |
| **4 — "The Executive View"** | 10 | 90s | Sarah's VP dashboard + executive summary | Prototype's **Narrative screen — Exec Summary tab** generates the executive close narrative (UC-20) live. Headline + highlights + risks + recommendation match the "$1.2M value / combined team $4.6M" narrative tone. |

**Implications for the build:**
1. **"Auto" playback mode on ContractReview** — Task 2.5 should include an "Auto" toggle that sequences the 8 steps (matching the guide's Step 1–8 descriptions) with visible pacing rather than racing to completion. Target ~3 minutes per contract so the demo hits the guide's timing.
2. **"Behind the Scenes" modals** — each step in the AgentActivityStrip should be clickable to reveal what that agent is doing (actions, systems, outputs) — matches the guide's transparency goal.
3. **Exec narrative tone** — the narrative agent's system prompt should produce prose suitable for a VP's board summary: short, quantified, grounded. Matches the guide's "Sarah Chen executive view" voice.
4. **Persona framing in the canned/Acme demo** — keep persona names visible (Rachel, Marcus, Sarah, Daniel in Nike mode; analogs in Acme mode) so the prototype's narrative stays consistent with how the presenter introduces the scenario.

## Sample contracts

Five supplied `.docx` contracts in `samples/acme/` are the canonical public-safe samples (committed, used for Acme Pages demo + fixture generation + regression tests):

1. `Contract_1_Advertising_Campaign.docx`
2. `Contract_2_Professional_Services_Outsourcing.docx`
3. `Contract_3_Insurance_MultiYear.docx`
4. `Contract_4_Construction_Retail_Remodel.docx`
5. `Contract_5_AWS_Enterprise.docx`

Because the supplied files are `.docx`, the ingest layer supports both `.docx` (via `mammoth`) and `.pdf` (via `pdfjs-dist`). Users may drop either format into `samples/user/` (gitignored) for live-mode demos.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  React SPA (Vite + TS + shadcn/ui)                                       │
│     screens · agents · adapters (LiveAgent | CannedAgent)                │
└──────────┬────────────────────────────────┬──────────────────────────────┘
           │ HTTP (fetch)                   │ HTTP (fetch)
           ▼                                ▼
┌───────────────────────┐      ┌────────────────────────────────────────┐
│  Ollama (localhost    │      │  Server (Node/Express + TypeScript)    │
│  :11434)              │      │    /api/contracts  · /api/metabase     │
│   • qwen2.5:7b        │      │    /api/search     · /api/audit        │
│   • nomic-embed-text  │      │   ingest (pdf-parse + mammoth)         │
└───────────────────────┘      │   embeddings (nomic-embed-text 768d)   │
                               └──────────┬─────────────────────────────┘
                                          │
                                          ▼
                               ┌────────────────────────────────────────┐
                               │  PostgreSQL 16 + pgvector (Docker)     │
                               │    contracts         (bytea blobs)     │
                               │    contract_metabase (metadata +       │
                               │                       embedding vec)   │
                               │    audit_events      (SOX trail)       │
                               │    pnl_lines         (narrative seed)  │
                               └────────────────────────────────────────┘
```

**Three tiers:**
- **Frontend** — React SPA; calls Ollama directly for LLM and the server for persistence/search
- **Server** — Express API; stores contract blobs, runs document ingest server-side, calls Ollama embeddings, exposes CRUD + semantic search
- **Database** — PostgreSQL 16 with pgvector extension; runs in Docker; contracts stored as `bytea`, metabase with vector embeddings for nearest-neighbor search

Mode switch: `VITE_MODE=live|canned` drives adapter choice and theme. **Live mode** uses the full stack (React + Server + Postgres + Ollama). **Canned mode** (GitHub Pages) bypasses the backend and reads fixtures from the bundle — Pages is static, no server.

### Key architectural decisions

1. **Single codebase, two modes.** `VITE_MODE` env var at build/dev time picks `LiveAgent` vs `CannedAgent` and `nikeTheme` vs `acmeTheme`. UI components are mode-agnostic.
2. **Three-tier live mode; two-tier canned mode.** Live mode persists uploads and metabase rows in Postgres via the Server API. Canned mode is a static bundle with no server (GitHub Pages). The `LiveAgent` adapter talks to the server; `CannedAgent` reads bundled JSON fixtures.
3. **Blob + metabase split.** `contracts` table holds bytes (deduped by SHA-256); `contract_metabase` holds all agent outputs (27 attributes, risk, tech-acct flags, proposed JE, narrative, full_text, embedding) one-to-one. Keeps blob operations cheap and metabase queryable.
4. **Vectorized metabase column.** The `embedding` column on `contract_metabase` is `VECTOR(768)` populated from `nomic-embed-text` (via Ollama) on upload. `ivfflat` index with cosine ops enables semantic search — "find contracts like this one" or free-text query.
5. **Agent Adapter interface.** Both implementations satisfy one `Agent` interface (`extractAttributes`, `scoreRisk`, `flagTechnicalAccounting`, `calculateAccrual`, `generateVarianceCommentary`, `generateExecutiveSummary`). Enables fixture generation by running `LiveAgent` once and capturing outputs for `CannedAgent`.
3. **Deterministic accrual math.** LLM extracts terms as strings/dates only. TypeScript functions compute dollar amounts. Type system enforces the seam: `AccrualInputs` has no numeric fields; `ProposedJE` amounts are constructed only inside `accrual.ts`.
4. **Narrative is grounded, not generative.** LLM commentary is produced from concrete seeded line items (current vs prior, variance $, %, drivers). Prompts forbid fabricating numbers; output is prose only.
5. **Scripted chrome, live agents — explicit seam.** Close simulation and dashboards are animated from the existing HTML demos. Contract→JE chain and narrative generation are the only real-AI flows. A `ModeBanner` (dev-only, hidden via `Ctrl+Shift+D`) shows which mode is active.
6. **Deloitte contracts never reach git.** `/samples/user/` gitignored; pre-commit hook rejects PDF/DOCX blobs in that path.
7. **Fixtures are frozen real outputs.** `pnpm generate-fixtures` runs `LiveAgent` against `/samples/acme/*.{pdf,docx}` and over the seeded P&L set, and commits the JSON. Canned mode replays with artificial 200–800ms step delays so the agent strip still animates.

## Component map

### Screens

| Route | Component | Live AI? |
|---|---|---|
| `/` | `CloseCockpit` — 4-phase timeline, 6 entities, journey map, event log | No |
| `/contracts` | `ContractQueue` — risk-ranked list | **UC-08** |
| `/contracts/:id` | `ContractReview` — document viewer + attribute checklist + technical accounting flags | **UC-07, UC-09** |
| `/contracts/:id/accrual` | `AccrualProposal` — calc detail + proposed JE card | **UC-10** |
| `/narrative` | `Narrative` — two tabs: Variance Commentary, Executive Summary | **UC-18, UC-20** |
| `/copilot` | `CopilotPanel` — chat with pre-canned topic routing | No |
| `/architecture` | Embedded `nike-r2r-architecture.html` | No |

### Shared components

- `AgentActivityStrip` — live progress for Extractor → Risk → TechAcct → Accrual (contract flow) or Narrative-Variance / Narrative-Exec (narrative flow)
- `EvidenceHover` — field hover highlights source clause in the document viewer
- `ConfidenceBadge` — green/amber/red with numeric confidence
- `VarianceTable` — P&L grid with per-row "Generate commentary" action
- `CommentaryPanel` — streaming-style narrative panel with drivers, risk flags, copy/accept buttons
- `ExecSummaryCard` — headline, highlights, risks, recommendation — print/copy-to-clipboard
- `JECard` — two-column T-account with debits/credits, totals, reversal date, approve/reject
- `ModeBanner` — dev-only indicator of live vs canned

## Data flow — live mode (contract chain)

```
Contract upload (.pdf or .docx) → ingest (pdfjs-dist | mammoth) → text + page-anchored spans
          → orchestrator.ts emits "extracting"
          → extractor.ts (Qwen, JSON mode, 27-attribute schema, per-field confidence)
          → risk.ts (rules + LLM signal) → {score, category, reasons[]}
          → tech-accounting.ts (Qwen classifier) → {lease, derivative, expense_method}
          → ContractReview renders (checklist + flags + evidence)
          → user: "Propose Accrual"
          → accrual.ts: extractor pulls terms (string/date) → TS math → ProposedJE
          → AccrualProposal renders JE card with clause-level traceability
          → user: Approve → toast + audit-log entry in CloseCockpit event log
```

## Data flow — live mode (narrative chain)

```
Variance Commentary:
  seeded P&L line (current, prior, variance $ + %, drivers)
          → orchestrator emits "narrative-variance"
          → narrative.generateVarianceCommentary(line) → {commentary, key_drivers, risk_flags, confidence}
          → CommentaryPanel renders streaming-style prose

Executive Summary:
  close metrics (from simulation) + top variances + top risks
          → orchestrator emits "narrative-exec"
          → narrative.generateExecutiveSummary(inputs) → {headline, key_highlights, risks, recommendation}
          → ExecSummaryCard renders
```

## Data flow — canned mode (Pages)

- Contract hash (SHA-256 of file bytes) → `fixtures/<hash>.json` lookup
- Narrative fixtures keyed by line-item ID + period combination
- `CannedAgent` replays with artificial step delays
- Unknown hash → modal: "This demo only works with bundled Acme contracts"
- No live fallback on Pages

## Error handling

| Failure | Handling |
|---|---|
| Ollama not running (live) | Pre-flight modal with setup + Retry; blocks `/contracts` and `/narrative` until healthy |
| Qwen returns malformed JSON | Retry once with correction prompt; on 2nd fail, partial result + red banner |
| Extraction yields <200 chars (scanned PDF) | "OCR not included — use text-based PDF or DOCX". No fabricated extraction |
| Field confidence <0.5 | Amber badge + "low confidence — please verify". Never hidden |
| Accrual inputs missing | Refuse to run; show checklist of missing inputs linked to clauses |
| Narrative output contains a number not present in the input line | Regenerate once with stricter grounding prompt; if still present, flag "requires review" |

## Demo-safety guardrails

- ModeBanner visible in dev; hidden via shortcut for clean presentations
- Type-enforced separation: LLM outputs never become JE numbers
- Narrative prompts forbid number generation; LLM produces prose only, grounded in supplied values
- Every live agent call logged to dev console panel (prompt + response + latency)
- Deloitte contracts enforced out of git via `.gitignore` + pre-commit hook

## Testing

- **Vitest unit:** accrual math, risk rules, fixture lookup, theme resolver, narrative grounding helpers
- **Playwright E2E:** Acme contract upload → UI transitions → JE renders with expected amount (canned mode is deterministic); Narrative tab → generate commentary → assert prose renders
- **Prompt regression harness:** `pnpm test:prompts` runs live Qwen against golden Acme set; diffs against expected attributes AND expected narrative key phrases. Catches prompt drift.
- No tests for scripted screens beyond basic render; manual QA in dress-rehearsal.

## Repo layout

```
Nike/02_projects/FY27_Pipeline/r2r-agentic/Prototype/
├── README.md
├── package.json                 (frontend)
├── vite.config.ts
├── .env.example
├── .gitignore
├── docker-compose.yml           (postgres+pgvector, adminer)
├── docker/
│   └── init.sql                 (schema — contracts, metabase, audit, pnl)
├── server/                      (Node/Express backend)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── README.md
│   └── src/
│       ├── index.ts             (Express app)
│       ├── db.ts                (pg pool + pgvector types)
│       ├── lib/
│       │   ├── ingest.ts        (pdf-parse + mammoth → text + hash)
│       │   └── embeddings.ts    (Ollama nomic-embed-text → 768d)
│       ├── routes/
│       │   ├── contracts.ts     (CRUD + blob stream + upload→embed)
│       │   ├── metabase.ts      (PATCH agent-derived metadata)
│       │   ├── search.ts        (semantic + similar + attribute)
│       │   └── audit.ts         (event log)
│       └── scripts/
│           └── seed-samples.ts  (ingest samples/acme/* into DB)
├── src/                         (frontend)
│   ├── agents/                  (extractor, risk, tech-accounting, accrual, narrative, orchestrator)
│   ├── adapters/                (LiveAgent, CannedAgent)
│   ├── components/
│   ├── screens/                 (CloseCockpit, ContractQueue, ContractReview, AccrualProposal, Narrative, CopilotPanel)
│   ├── store/                   (zustand)
│   ├── data/                    (seed-pnl, copilot-canned-answers)
│   ├── lib/
│   │   └── api-client.ts        (fetch wrappers for server endpoints — live mode only)
│   ├── theme/                   (nike.ts, acme.ts, mode-aware index.ts)
│   └── scripts/generate-fixtures.ts
├── samples/
│   ├── acme/                    (committed — 5 supplied .docx contracts)
│   ├── user/                    (gitignored — Deloitte contracts, any format)
│   └── README.md
├── fixtures/                    (committed canned outputs for acme/* and narrative seeds)
├── tests/ (unit + e2e + golden)
└── .github/workflows/pages.yml
```

## Scripts

```json
{
  "dev": "VITE_MODE=live vite",
  "dev:canned": "VITE_MODE=canned vite",
  "build:pages": "VITE_MODE=canned vite build --base=/nike-r2r-demo/",
  "generate-fixtures": "tsx src/scripts/generate-fixtures.ts",
  "test": "vitest run && playwright test",
  "test:prompts": "tsx src/scripts/prompt-regression.ts"
}
```

## Local setup (Nike mode — full stack)

```powershell
# One-time
winget install pnpm
winget install Ollama.Ollama
winget install Docker.DockerDesktop
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# Each run — three processes
cd Prototype
docker compose up -d postgres          # Postgres :5434
pnpm --filter server install && cd server && pnpm dev &    # Server :3001
cd .. && pnpm install && pnpm dev      # Frontend :5173

# First-time seed (after server is healthy)
cd server && pnpm seed
```

Optional admin UI: `docker compose --profile tools up -d adminer` → http://localhost:8081

## GitHub Pages (Acme mode)

- Repo owner: TBD (Keven's GH or deloitte-consulting org)
- Workflow on push to `main`: `pnpm build:pages` → deploy to `gh-pages`
- Fixtures committed so Pages build needs no Ollama

## Build-time estimate (Claude-session hours)

Per-PUC estimates roll up from `NOAH-Prototype-Sprint-Plan.xlsx` (34 PUCs).

| Sprint | Scope | Hours |
|---|---|---|
| PS-01 Foundation | React scaffold, Ollama client, PDF + DOCX ingest, port close sim + Copilot panel | 9–13 |
| PS-02 UC-07 | 27-attribute schema + extractor + adapter + contract queue + review UI + Ollama guard | 8–11 |
| PS-03 UC-08 + UC-09 | Risk scoring + ASC flags + risk/flags UI | 4–7 |
| PS-04 UC-10 | Accrual inputs + deterministic math + JE builder + orchestration + proposal screen | 7–10 |
| **PS-05 Narrative (NEW)** | **Seed P&L + variance commentary + executive narrative + screen + cockpit integration** | **6–10** |
| PS-06 Canned + Pages | CannedAgent adapter, fixture generator, sample-verify, Pages workflow | 4–5 |
| PS-Final | README, regression harness, Playwright E2E, pre-commit guard, dress rehearsal | 5–8 |
| **Total** | | **~44–62 hrs** |

## Definition of done

- [ ] `pnpm dev` runs on a fresh Windows laptop with <5 min setup
- [ ] Upload a contract → agent strip animates → attributes render → risk + ASC flags → proposed JE with deterministic math
- [ ] Narrative screen generates variance commentary per P&L line (grounded in seeded numbers) and one-click executive close summary
- [ ] GitHub Pages URL loads Acme demo; all 5 contracts walk through contract→JE end-to-end; narrative tab produces commentary from fixtures
- [ ] Deloitte contracts absent from git history (verified)
- [ ] Prompt regression test passes on all 5 Acme samples + narrative golden set
- [ ] README has both setup paths + a 60-second demo script covering all three agent flows
