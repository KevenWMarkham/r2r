# NOAH Prototype — Roadmap & Backlog

**Source:** [DESIGN.md](./DESIGN.md)
**Companion docs:** [PLAN.md](./PLAN.md) (task-level steps) · [orchestrator.md](./orchestrator.md) (UC coverage + acceptance)
**Last updated:** 2026-04-21

Check off items as completed. Keep this in sync with commits (one backlog item per PR branch is a good rhythm).

## Legend

| Mark | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Completed & verified |
| `[!]` | Blocked — see notes |

## Progress snapshot

| Sprint | Items | Done | In-progress | Blocked |
|---|---|---|---|---|
| PS-00 Infrastructure (Docker + DB + Server + Ollama models) | 9 | 9 | 0 | 0 |
| PS-01 Foundation | 7 | 7 | 0 | 0 |
| PS-02 UC-07 Contract Extraction | 6 | 6 | 0 | 0 |
| PS-03 UC-08 + UC-09 Risk/Tech-Acct | 3 | 3 | 0 | 0 |
| PS-04 UC-10 Accrual/JE + Demo Polish | 6 | 6 | 0 | 0 |
| PS-05 UC-18 + UC-20 Narrative | 6 | 0 | 0 | 0 |
| PS-06 Canned Mode + Pages | 4 | 0 | 0 | 0 |
| PS-Final Packaging & QA | 5 | 0 | 0 | 0 |
| **Total** | **46** | **31** | **0** | **0** |

---

## PS-00 — Infrastructure (Docker + Postgres + Server)

*Scaffolding files are already present in `docker-compose.yml`, `docker/init.sql`, and `server/`. These backlog items track end-to-end integration validation.*

- [x] **BL.38** — Docker Compose brings up Postgres 16 + pgvector on `:5434`; healthcheck green; volume persists across restarts. ✅ 2026-04-21
- [x] **BL.39** — Schema applied via `docker/init.sql` on first boot: `contracts`, `contract_metabase` (with `VECTOR(768)` embedding column), `audit_events`, `pnl_lines`, `v_contract_summary` view. `vector` + `pgcrypto` extensions installed. ✅ 2026-04-21 (migrated ivfflat → HNSW index for small-dataset correctness)
- [x] **BL.40** — Server `pnpm dev` starts Express on `:3001`; `/health` returns `{ok:true, db:"connected"}`. ✅ 2026-04-21
- [x] **BL.41** — Document ingest (server-side): `pdf-parse` for `.pdf`, `mammoth` for `.docx`. Rejects scanned/empty documents with helpful error. ✅ 2026-04-21 (exercised via seed: 5 contracts, 4832–7400 chars each)
- [x] **BL.42** — Embedding service: `nomic-embed-text` via Ollama. `embed(text)` returns 768-dim vector. Dim-mismatch detection raises clear error. ✅ 2026-04-21
- [x] **BL.43** — Upload endpoint: `POST /api/contracts` accepts multipart → extracts → embeds → upserts blob + metabase + audit event atomically. SHA-256 dedup. ✅ 2026-04-21 (verified `is_new: false` on re-upload)
- [x] **BL.44** — Semantic search: `POST /api/search/semantic` with `{query}` returns top-k contracts by cosine distance. `/similar/:id` for similar-to-this. `/attributes?key=val` for JSONB filter. ✅ 2026-04-21 (Q1/Q2/Q3 each rank correct contract #1; bug fixed: `$1::vector` cast required)
- [x] **BL.45** — Seed script (`pnpm seed`) ingests all 5 Acme contracts from `samples/acme/` into Postgres with embeddings; `SELECT count(*) FROM contracts` returns 5. ✅ 2026-04-21
- [x] **BL.46** — Ollama models installed on the demo machine: `qwen2.5:7b` (LLM for extraction/narrative) and `nomic-embed-text` (embeddings). Verified via `ollama list` showing both models present. Prereq for BL.42 (embeddings) and all agent BLs in PS-02 onward. ✅ 2026-04-21

## PS-01 — Foundation

- [x] **BL.01** — Vite + React + TypeScript scaffold with pnpm (`package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`). Dev server runs locally; clean pnpm install. ✅ 2026-04-21 (build green, 1603 modules, 197 KB JS)
- [x] **BL.02** — Theme system + mode switch: `VITE_MODE=live|canned` drives both `nikeTheme` and `acmeTheme`; CSS vars injected at boot; all colors/fonts route through theme tokens. ✅ 2026-04-21 (`applyThemeToRoot()` in main.tsx; document title reflects brand)
- [x] **BL.03** — Ollama JSON-mode client with `chatJSON()` + `checkHealth()`, unit-tested; one-shot correction retry on malformed JSON; clear `OllamaError` type. ✅ 2026-04-21 (code in `src/agents/ollama-client.ts`; retry logic to be exercised by extractor in PS-02)
- [x] **BL.04** — Document ingest: **handled server-side** via BL.41 (pdf-parse + mammoth in `server/src/lib/ingest.ts`). Client uploads via `api-client.uploadContract()`; server returns SHA, extracted text, and embedding dim. No in-browser pdfjs-dist needed (simpler + consistent with canned mode). ✅ 2026-04-21
- [x] **BL.05** — Close Cockpit screen: 4 phases (Pre-Close → Execute → Validate → Gate), 6 entities, event log, journey map. Ported from `NikeR2R-v4-Compare.html`. Start/Pause/Reset control the scripted simulation. ✅ 2026-04-21 (`CloseCockpit.tsx` + `PhaseGrid` + `EntityList` + `EventLog` + `closeStore`)
- [x] **BL.06** — Copilot chat panel (scripted): 7 keyword routes (close status, exceptions, contracts, accruals, entity, variance, default fallback). 450ms "typing…" animation before reply. ✅ 2026-04-21
- [x] **BL.07** — App shell: React Router, Layout (header + nav + main + footer), `ModeBanner` (dev-only; `Ctrl+Shift+D` toggle), placeholder screens for all routes (/, /contracts, /contracts/:id, /contracts/:id/accrual, /narrative, /copilot). ✅ 2026-04-21

## PS-02 — Contract Attribute Extraction (UC-07)

- [x] **BL.08** — 27-attribute zod schema; each field is `{value, confidence: 0..1, source_page}`. Schema validates or rejects cleanly. ✅ 2026-04-21 (`src/agents/contract-schema.ts` + `ATTRIBUTE_LABELS` for UI)
- [x] **BL.09** — Extractor agent: Qwen call with JSON-mode schema hint; retries once on bad JSON; returns validated `ContractAttributes`. Partial salvage path when schema doesn't match cleanly. ✅ 2026-04-21 (smoke test: 21/27 populated at avg 0.78 confidence on Contract_1)
- [x] **BL.10** — Agent adapter interface + `LiveAgent` impl emitting step events (`extract | risk | techAcct | accrual | narrative-variance | narrative-exec`). ✅ 2026-04-21 (runStep helper wraps each agent call with event emission + error handling)
- [x] **BL.11** — Contract queue screen: drag-drop upload (`.pdf`/`.docx`), seed contracts + uploaded list, sortable by risk score (risk desc, filename asc). ✅ 2026-04-21
- [x] **BL.12** — Contract review screen: document viewer + `AttributeChecklist` (27 rows) + `AgentActivityStrip` + `ConfidenceBadge` (green/amber/red with page refs). Evidence highlight deferred (page-span hover) — non-blocking. ✅ 2026-04-21
- [x] **BL.13** — Ollama pre-flight `OllamaGuard` modal — wraps `/contracts` and `/contracts/:id` screens; shows setup instructions + Retry; canned mode bypasses. ✅ 2026-04-21

## PS-03 — Risk Scoring + Technical Accounting (UC-08, UC-09)

- [x] **BL.14** — Risk scoring: `scoreRules()` (0–60; TCV tiers, auto-renew, liability cap, lease, derivative) + `scoreLLM()` (0–40; qualitative signal on uncovered factors) → `{score, category: High|Med|Low, reasons[]}`. Graceful degradation on Ollama failure. ✅ 2026-04-21
- [x] **BL.15** — Technical accounting classifier: detects ASC 840/842 lease, ASC 815 derivative; returns expense recognition method (straight-line|immediate|direct-association|unknown) and `requires_senior_review` boolean. Structured attribute hints nudge classifier. ✅ 2026-04-21
- [x] **BL.16** — Risk + Tech-Acct UI: risk gauge (SVG circle, color-coded), category badge, contributing-factors list, ASC flag rows (red when flagged), mandatory-senior-review banner, expense method display. Queue sorts by risk score. ✅ 2026-04-21

## PS-04 — Accrual Calculation + JE + Demo Polish (UC-10)

- [x] **BL.17** — Accrual inputs extractor: LLM returns strings/dates ONLY; `AccrualInputs` type has zero numeric fields. `missing[]` populated on low-confidence extractions. ✅ 2026-04-21 (`src/agents/accrual-inputs.ts`)
- [x] **BL.18** — Deterministic accrual math: pure TypeScript; straight-line pro-ration + GR/IR-aware netting + zero-period handling + immediate + direct-association. Parses "$4.2M"/"USD 1,500"/etc. LLM outputs never become JE numbers (enforced by type seam). ✅ 2026-04-21 (`src/lib/accrual-math.ts`)
- [x] **BL.19** — JE builder: two-line entry (DR Expense 6810 / CR Accrued Liability 2310), debits = credits invariant (throws if violated), reversal = 1st of next month. ✅ 2026-04-21 (`src/lib/je-builder.ts`)
- [x] **BL.20** — Accrual agent orchestration: extract-strings → parse → math → build JE, with step events. `AccrualGapError` thrown with missing-field list on gaps; metabase status set to `missing_inputs`. ✅ 2026-04-21 (`src/agents/accrual.ts`)
- [x] **BL.21** — Accrual proposal screen: T-account `JECard` + `CalcDetailPanel` with inputs/math/clause-trace + Approve button writes audit event + pushes to close cockpit event log + navigates back. ✅ 2026-04-21
- [x] **BL.22** — **Demo polish:** Clickable `AgentActivityStrip` steps → `BehindTheScenesModal` showing Actions / Systems / Outputs / Handoff / Demo Note for each of 6 agent steps (extract/risk/techAcct/accrual/narrative-variance/narrative-exec). Esc-to-close, click-outside-to-close. Auto-run pacing is naturally sequential via await-chain; canned mode (PS-06) adds per-step dwells. ✅ 2026-04-21

## PS-05 — Narrative Agent (UC-18, UC-20)

- [ ] **BL.23** — Seed P&L dataset: 12–15 line items, current vs prior period, variance $ and %, entity split (NA/EMEA/GC/APLA), drivers string. Rich enough that Qwen can ground without fabricating.
- [ ] **BL.24** — Variance commentary agent (UC-18): Qwen produces 2–3 sentence prose per line item grounded ONLY in supplied numbers; returns `{commentary, key_drivers[], risk_flags[], confidence}`.
- [ ] **BL.25** — Executive summary agent (UC-20): takes close metrics + top variances + risks → `{headline, key_highlights[], risks[], recommendation}`. Board-ready tone.
- [ ] **BL.26** — Adapter extension: `generateVarianceCommentary` + `generateExecutiveSummary` on Agent interface; LiveAgent wires events.
- [ ] **BL.27** — Narrative screen (Variance Commentary tab): P&L grid + per-row Generate button + `CommentaryPanel` with streaming-style prose, drivers, risk flags, Copy-to-Clipboard, Accept/Edit.
- [ ] **BL.28** — Exec Summary tab + Cockpit integration: Narrative screen second tab; Close Cockpit shows "Generate Close Narrative" at Gate phase → navigates to `/narrative?tab=exec&autorun`. Matches Demo Moment 4.

## PS-06 — Canned Mode + GitHub Pages

- [ ] **BL.29** — `CannedAgent` fixture replay: loads `fixtures/<hash>.json` for contracts + narrative fixtures by line-item ID; replays with 200–800ms delays; unknown hash → "This demo only works with bundled samples" modal.
- [ ] **BL.30** — Fixture generator script: `pnpm generate-fixtures` walks `samples/acme/*.{pdf,docx}` + seed P&L, runs LiveAgent chain, writes `fixtures/*.json`, commits deterministically.
- [ ] **BL.31** — Sample contracts in `samples/acme/` (5 supplied): Advertising Campaign, Professional Services Outsourcing, Insurance Multi-Year, Construction Retail Remodel, AWS Enterprise. Plus `samples/README.md` on how to add more.
- [ ] **BL.32** — GitHub Pages deploy workflow (`.github/workflows/pages.yml`): on push to `main`, `pnpm build:pages` → deploy to `gh-pages`. Public URL loads Acme theme demo.

## PS-Final — Packaging & QA

- [ ] **BL.33** — Full README with both setup paths (Nike live / Acme Pages), 60-second demo script covering all 3 agent flows, troubleshooting (Ollama, scanned PDFs).
- [ ] **BL.34** — Prompt regression harness: `pnpm test:prompts` runs LiveAgent against 5 Acme contracts + narrative golden set; diffs against expected attributes/phrases; fails on drift.
- [ ] **BL.35** — Playwright E2E (canned mode): contract upload → extract → review → propose → approve flow; narrative tab generates commentary. Deterministic assertions on JE amount.
- [ ] **BL.36** — Pre-commit hook (husky) rejects staged files under `samples/user/` (except `.gitkeep`); blocks both `.pdf` and `.docx`. Belt-and-suspenders with `.gitignore`.
- [ ] **BL.37** — Dress rehearsal on a fresh Windows laptop: clone → setup < 5 min → run full demo in both modes including narrative. Polish rough edges. Tag `v0.1.0`.

---

## Cross-cutting demo-safety guardrails (should be in place throughout)

These are not standalone BL items but are verified during each phase's checkpoint:

- [ ] Type system prevents LLM output from becoming JE dollar amounts (checked via `accrual-math` tests and manual review of `JELine.debit/credit` callers)
- [ ] ModeBanner shows correct mode (live vs canned) and toggles via keyboard
- [ ] All live agent calls logged to dev console panel (prompt + response + latency)
- [ ] Narrative prompts forbid number generation; verified by prompt-regression golden set
- [ ] `samples/user/` and its contents never appear in `git log` / `git diff` history
- [ ] `ModeBanner` hidden in production builds (`import.meta.env.PROD` check)
- [ ] Audit-event row written server-side for every destructive/approving action (upload, approve, delete)
- [ ] Server rejects non-PDF/DOCX uploads at the ingest layer (file-type whitelist)
- [ ] DB schema never exposes bytes over `/api/metabase` (blobs only via `/api/contracts/:id/blob`)

---

## Notes

- **Merge strategy:** one backlog item = one PR branch = one review checkpoint. Avoids mid-flight scope shifts.
- **Sprint checkpoints:** each phase ends with a git tag (`ps-01-foundation` … `ps-07-final`) before moving on.
- **Updating this doc:** when a BL item completes, flip its checkbox AND update the progress-snapshot table at the top. Commit that doc update alongside the feature.
- **Adding items:** keep numbering sequential (BL.38, BL.39…). Don't renumber; new items append.
