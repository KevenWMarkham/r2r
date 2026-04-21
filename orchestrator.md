# NOAH Prototype — Orchestrator

**Purpose:** Living traceability matrix and acceptance tracker. Maps every NOAH use case in prototype scope to its sprint, tasks, subtasks, backlog items, code modules, tests, and acceptance evidence. Validates **code coverage** of use cases and supports **user acceptance testing**.

**Related docs:** [DESIGN.md](./DESIGN.md) · [PLAN.md](./PLAN.md) · [roadmap.md](./roadmap.md) · [NOAH-Prototype-Sprint-Plan.xlsx](./NOAH-Prototype-Sprint-Plan.xlsx)
**Use case spec (source):** `../NOAH-Sprint-Plan.xlsx`
**Last updated:** 2026-04-21

## How to use this document

1. **During build** — implementer updates the "Code Coverage" and "Tests" cells as modules/tests land; flips status to `⏳ In Progress` or `✅ Complete`.
2. **At sprint checkpoint** — reviewer walks each UC in that sprint's scope; verifies acceptance evidence; flips to `✅ Accepted` once validated live.
3. **For UAT with Nike stakeholders** — §"User Acceptance Test Scripts" at the bottom lists the click-paths. Run each and capture sign-off.

## Status legend

| Status | Meaning |
|---|---|
| `⬜ Pending` | Work not started |
| `⏳ In Progress` | Code exists but acceptance not yet verified |
| `✅ Complete` | Code + tests done; awaiting acceptance walkthrough |
| `☑ Accepted` | Acceptance verified by reviewer (sign-off) |
| `⚠ At Risk` | Build issue or gap — see notes |

---

## Coverage summary

| NOAH UC | Description | Persona | Sprint | Status | Code Coverage | Tests | Accepted By |
|---|---|---|---|---|---|---|---|
| UC-07 | AI attribute extraction (27 attrs) | Marcus | PS-02 | ⬜ Pending | 0% | 0/1 | — |
| UC-08 | Risk-ranked contract queue | Marcus/Rachel | PS-02 + PS-03 | ⬜ Pending | 0% | 0/1 | — |
| UC-09 | Derivative/lease flagging (ASC 840/842/815) | Marcus | PS-03 | ⬜ Pending | 0% | 0/1 | — |
| UC-10 | Auto-calculated accruals + one-click JE | Marcus | PS-04 | ⬜ Pending | 0% | 0/2 | — |
| UC-13 | Automated close phase progression | Rachel | PS-01 (scripted) | ⬜ Pending | 0% | manual | — |
| UC-14 | SLA breach prediction | Rachel | PS-01 (scripted) | ⬜ Pending | 0% | manual | — |
| UC-15 | Gate check approval flow | Rachel | PS-01 (scripted) | ⬜ Pending | 0% | manual | — |
| UC-18 | AI-drafted variance commentary | Daniel | PS-05 | ⬜ Pending | 0% | 0/1 | — |
| UC-20 | Executive close narrative | Sarah | PS-05 | ⬜ Pending | 0% | 0/1 | — |
| UC-23 | Automatic action logging (scaffolded) | Sarah | PS-00 | ⬜ Pending | 0% | manual | — |
| UC-25 | NL close queries in Teams | Rachel | PS-01 (scripted) | ⬜ Pending | 0% | manual | — |

**Real-AI UCs (live Qwen):** UC-07, UC-08, UC-09, UC-10, UC-18, UC-20
**Scripted UCs (ported from existing HTMLs):** UC-13, UC-14, UC-15, UC-25
**Infrastructure UCs (server+DB scaffolding):** UC-23 (audit trail persisted in Postgres `audit_events`)

## Infrastructure validation (PS-00 — Docker + DB + Server)

Before any UC-level work starts, these infra acceptances must pass. Each backlog item (BL.38–BL.45) has its own acceptance below.

### Quick smoke-test matrix

| Check | Command | Expected |
|---|---|---|
| Docker up | `docker compose up -d postgres` | `noah-postgres` container healthy |
| DB reachable | `curl http://localhost:3001/health` | `{ok: true, db: "connected"}` |
| Schema applied | `docker exec noah-postgres psql -U noah -d noah -c "\dt"` | Lists `contracts`, `contract_metabase`, `audit_events`, `pnl_lines` |
| pgvector installed | `docker exec noah-postgres psql -U noah -d noah -c "SELECT extname FROM pg_extension"` | `vector` present |
| Embedding works | `curl -X POST http://localhost:3001/api/search/semantic -H 'Content-Type: application/json' -d '{"query":"test","limit":1}'` | 200 (empty `results` is fine pre-seed) |
| Seed runs | `cd server && pnpm seed` | 5 rows in `contracts`; 5 rows in `contract_metabase` with non-null `embedding` |
| Semantic search | Post query "lease for data center" | Lease/real-estate-adjacent contract ranks top 2 |
| Audit log | Upload a contract, then `GET /api/audit?contract_id=...` | Returns ≥1 event with `event_type='upload'` |

---

### BL.38 — Docker Compose: Postgres + pgvector on :5434

**Files:** `docker-compose.yml`

**Acceptance:**
- [ ] `docker compose up -d postgres` completes without error
- [ ] `docker compose ps` shows `noah-postgres` in `healthy` state within 30s
- [ ] Port 5434 is reachable: `psql postgresql://noah:noah@localhost:5434/noah -c "SELECT 1"`
- [ ] Container restart preserves data (volume `noah_pgdata` persists)
- [ ] Optional: `docker compose --profile tools up -d adminer` exposes UI on :8081
- [ ] **Accepted by:** _________ on _________

### BL.39 — Schema: contracts, contract_metabase, audit_events, pnl_lines + pgvector/pgcrypto

**Files:** `docker/init.sql`

**Acceptance:**
- [ ] `SELECT extname FROM pg_extension` returns both `vector` and `pgcrypto`
- [ ] All 4 tables + `v_contract_summary` view exist (`\dt` + `\dv`)
- [ ] `contract_metabase.embedding` column type is `vector(768)`
- [ ] `idx_metabase_embedding` is an `ivfflat` index with `vector_cosine_ops`
- [ ] `idx_metabase_attributes` is a `gin` index on the JSONB column
- [ ] `touch_updated_at` trigger fires on metabase UPDATE (inspect `updated_at` changes)
- [ ] `CHECK` constraints reject invalid `file_type` and `risk_category` values
- [ ] **Accepted by:** _________ on _________

### BL.40 — Express server on :3001 with /health

**Files:** `server/src/index.ts`, `server/src/db.ts`

**Acceptance:**
- [ ] `pnpm dev` in `server/` starts without error; watches source
- [ ] `GET /health` returns `{ok: true, db: "connected", pg_version: "..."}`
- [ ] CORS allows `http://localhost:5173` (Vite dev)
- [ ] Invalid route returns 404 JSON (not HTML)
- [ ] Thrown errors return 500 JSON with message; no stack leaks in production
- [ ] pgvector types auto-register on each connection (no manual SQL casts needed)
- [ ] **Accepted by:** _________ on _________

### BL.41 — Document ingest (pdf-parse + mammoth)

**Files:** `server/src/lib/ingest.ts`

**Acceptance:**
- [ ] `.pdf` files extract text via `pdf-parse`
- [ ] `.docx` files extract text via `mammoth`
- [ ] Unsupported extensions (e.g., `.txt`, `.png`) throw `IngestError` with clear message
- [ ] Scanned/empty documents (<200 chars) throw `IngestError` suggesting text-based formats
- [ ] SHA-256 hash computed deterministically (same bytes → same hash)
- [ ] **Accepted by:** _________ on _________

### BL.42 — Embedding service (nomic-embed-text → 768-dim)

**Files:** `server/src/lib/embeddings.ts`

**Acceptance:**
- [ ] `embed(text)` returns exactly 768 numbers
- [ ] Ollama unreachable → `EmbeddingError` with actionable hint
- [ ] Long inputs (>8000 chars) are truncated, not rejected
- [ ] Empty/whitespace input throws clear error (prevents polluting index)
- [ ] Dimension mismatch (if model changed) surfaces immediately with exact got/expected count
- [ ] **Accepted by:** _________ on _________

### BL.43 — Upload endpoint: extract → embed → upsert + audit

**Files:** `server/src/routes/contracts.ts`

**Acceptance:**
- [ ] `POST /api/contracts` with multipart `file` field returns `201` and contract ID
- [ ] Response includes `is_new: true` for first upload; `is_new: false` for re-upload of same bytes (SHA dedup)
- [ ] Row appears in `contracts` with correct `file_type`, `byte_size`, `sha256`
- [ ] Matching row appears in `contract_metabase` with non-null `full_text` and `embedding`
- [ ] `audit_events` gets an `upload` event within same transaction
- [ ] 25 MB upload limit enforced; 26 MB returns 413 or 400
- [ ] Missing `file` field returns 400 with helpful message
- [ ] `GET /api/contracts/:id/blob` streams the original bytes with correct `Content-Type`
- [ ] `DELETE /api/contracts/:id` cascades to metabase (verify row count drops)
- [ ] **Accepted by:** _________ on _________

### BL.44 — Semantic search endpoints

**Files:** `server/src/routes/search.ts`

**Acceptance:**
- [ ] `POST /api/search/semantic` with `{query: "...", limit: N}` returns top-N by cosine distance
- [ ] Results include `similarity` field (1.0 = identical, 0.0 = orthogonal)
- [ ] Short queries (<3 chars) return 400 with validation error
- [ ] `POST /api/search/similar/:contractId` returns ≥1 result excluding the source contract
- [ ] `GET /api/search/attributes?counterparty=...` filters by JSONB attribute equality
- [ ] Query time for 5 contracts is <500ms (ivfflat sanity check; scales to ~1M rows)
- [ ] **Accepted by:** _________ on _________

### BL.45 — Seed samples script

**Files:** `server/src/scripts/seed-samples.ts`

**Acceptance:**
- [ ] `pnpm seed` from `server/` walks `../samples/acme/*.docx`
- [ ] All 5 contracts ingested; `SELECT count(*) FROM contracts WHERE source = 'sample_acme'` = 5
- [ ] All 5 have non-null embeddings in metabase
- [ ] Re-running `pnpm seed` is idempotent (no duplicate rows; SHA dedup)
- [ ] Script logs one line per contract with ID and status (new|updated)
- [ ] **Accepted by:** _________ on _________

### BL.46 — Ollama models pulled (qwen2.5:7b + nomic-embed-text)

**Files:** n/a (host machine setup)

**Acceptance:**
- [ ] `ollama list` shows `qwen2.5:7b` (LLM — ~5GB download)
- [ ] `ollama list` shows `nomic-embed-text` (embeddings — ~275MB download)
- [ ] Test LLM: `ollama run qwen2.5:7b "Return JSON: {\"ok\": true}"` → returns valid JSON
- [ ] Test embeddings: `curl -X POST http://localhost:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"test"}'` returns 768-element `embedding` array
- [ ] Both models start on Ollama boot (no pull-on-first-use delays in demo)
- [ ] **Accepted by:** _________ on _________

---

### Overall PS-00 acceptance checklist

- [ ] All 9 backlog items (BL.38–BL.46) accepted
- [ ] `SELECT count(*) FROM contracts` = 5 after seed
- [ ] `SELECT count(*) FROM contract_metabase WHERE embedding IS NOT NULL` = 5
- [ ] Semantic search for "professional services outsourcing" ranks Contract_2 first
- [ ] Semantic search for "commercial lease" ranks a real-estate-adjacent contract high
- [ ] Uploading Contract_1 a second time returns `is_new: false` (dedup works)
- [ ] Deleting a contract cascades to metabase (row count drops by 1)
- [ ] All audit events captured with timestamps
- [ ] **PS-00 accepted by:** _________ on _________

---

## UC-07 — AI Contract Attribute Extraction (Marcus Rivera)

### Acceptance criteria (from NOAH-Sprint-Plan.xlsx)

> Given a contract >$1M is uploaded or linked (new or modified contracts identified by Controlling), when Document Intelligence processes it, then **≥95% of the 27 standard attributes are extracted correctly** and presented in a pre-filled checklist for validation.

### Prototype acceptance (adjusted for prototype scope)

- ≥80% of 27 attributes populated with confidence ≥0.5 on the 5 supplied Acme contracts
- Every attribute shows `value`, `confidence`, `source_page`
- Low-confidence fields (<0.5) render amber with "please verify" label — never hidden
- Schema is exactly 27 fields — no more, no less

### Implementation mapping

| Layer | Module | Status |
|---|---|---|
| Schema | `src/agents/contract-schema.ts` (BL.08) | ⬜ |
| Agent | `src/agents/extractor.ts` (BL.09) | ⬜ |
| Adapter | `src/adapters/live-agent.ts::extractAttributes` (BL.10) | ⬜ |
| UI — queue | `src/screens/ContractQueue.tsx` (BL.11) | ⬜ |
| UI — review | `src/screens/ContractReview.tsx`, `AttributeChecklist.tsx`, `ConfidenceBadge.tsx`, `EvidenceHover.tsx` (BL.12) | ⬜ |
| Tests | `src/agents/contract-schema.test.ts`, `src/agents/extractor.test.ts` | ⬜ |

### Validation checklist

- [ ] Unit tests pass (schema validation, extractor JSON handling, retry on bad output)
- [ ] Live extraction runs against at least 3 supplied Acme contracts with ≥80% fields populated
- [ ] Confidence badges render correctly (green ≥0.8, amber 0.5–0.8, red <0.5)
- [ ] Source-page references clickable and accurate
- [ ] **Accepted by:** _________ on _________

---

## UC-08 — Risk-Ranked Contract Queue (Marcus / Rachel)

### Acceptance criteria

> Given 34 contracts require review in a period, when Marcus opens his task list, then contracts are ranked by ML risk score (highest risk first) with risk category label (High/Medium/Low) and estimated review time.

### Prototype acceptance

- Queue sorts by `riskScore` descending by default
- Each row shows: title, counterparty, TCV, risk badge (High/Med/Low with color), risk score (0–100), status
- Risk reasons visible on row hover or detail click
- Uploaded contracts re-sort live once risk agent returns

### Implementation mapping

| Layer | Module | Status |
|---|---|---|
| Scoring (rules + LLM) | `src/agents/risk.ts` (BL.14) | ⬜ |
| Adapter | `src/adapters/live-agent.ts::scoreRisk` | ⬜ |
| UI | `src/screens/ContractQueue.tsx` sort logic (BL.11) + risk badges (BL.16) | ⬜ |
| Tests | `src/agents/risk.test.ts` | ⬜ |

### Validation checklist

- [ ] `scoreRules` unit tests pass (TCV threshold, auto-renew, liability cap, lease, derivative combinations)
- [ ] Queue visually ranks contracts High → Low
- [ ] Category label matches numeric score boundary
- [ ] Risk reasons list is populated and human-readable
- [ ] **Accepted by:** _________ on _________

---

## UC-09 — Embedded Derivative / Lease Flagging (Marcus)

### Acceptance criteria

> Given a contract contains lease components or embedded derivatives, when AI extracts attributes, then these are explicitly flagged with ASC 840/842 and ASC 815 tags plus expense recognition method (straight-line, immediate, direct association), requiring mandatory senior review before sign-off.

### Prototype acceptance

- For the Prologis lease sample → ASC 842 flagged with reasoning
- For the NimbusCloud CPI escalator sample → ASC 815 review flag raised
- Each flag shows standard reference (ASC 840/842 or 815), reasoning, and `requires_senior_review` boolean
- Expense recognition method displayed alongside: straight-line | immediate | direct-association | unknown

### Implementation mapping

| Layer | Module | Status |
|---|---|---|
| Classifier | `src/agents/tech-accounting.ts` (BL.15) | ⬜ |
| Adapter | `src/adapters/live-agent.ts::flagTechnicalAccounting` | ⬜ |
| UI | `src/components/TechAccountingFlags.tsx` + "Mandatory Senior Review" banner (BL.16) | ⬜ |
| Tests | `src/agents/tech-accounting.test.ts` | ⬜ |

### Validation checklist

- [ ] Unit tests pass for lease and derivative detection
- [ ] Lease sample triggers ASC 842 flag + straight-line expense method
- [ ] SaaS/CPI sample triggers ASC 815 review
- [ ] Senior review banner appears when `requires_senior_review === true`
- [ ] **Accepted by:** _________ on _________

---

## UC-10 — Auto-Calculated Accruals + One-Click JE (Marcus)

### Acceptance criteria

> Given a services contract (Beeline) with defined terms, when period-end arrives, then NOAH calculates the accrual based on fee schedule, service dates, and amounts incurred to date (considering existing GR/IR in SAP to avoid duplication), presents the proposed journal entry with supporting calculation detail, for one-click approval.

### Prototype acceptance (**the "not vaporware" moment**)

- For any contract with extractable fee schedule + service dates, a proposed accrual JE is generated
- **JE dollar amounts are produced by TypeScript math, not LLM** — enforced by type system
- JE shows: debit line (Expense GL), credit line (Accrued Liability), period, reversal date, supporting calc string, contract clause references (clickable → PDF page)
- Approve button emits audit event to Close Cockpit event log
- Missing inputs → refuse to run with a checklist of what's missing linked to contract clauses

### Implementation mapping

| Layer | Module | Status |
|---|---|---|
| Inputs extractor (strings/dates only) | `src/agents/accrual-inputs.ts` (BL.17) | ⬜ |
| Math (pure TS, TDD) | `src/lib/accrual-math.ts` (BL.18) | ⬜ |
| JE builder | `src/lib/je-builder.ts` (BL.19) | ⬜ |
| Orchestration | `src/agents/accrual.ts` (BL.20) | ⬜ |
| Adapter | `src/adapters/live-agent.ts::calculateAccrual` | ⬜ |
| UI | `src/screens/AccrualProposal.tsx`, `JECard.tsx`, `CalcDetailPanel.tsx` (BL.21) | ⬜ |
| Tests | `src/agents/accrual-inputs.test.ts`, `src/lib/accrual-math.test.ts`, `src/lib/je-builder.test.ts` | ⬜ |

### Validation checklist

- [ ] Accrual math unit tests pass for: straight-line, GR/IR netting, zero-period
- [ ] JE builder unit test: debits = credits; reversal = 1st of next month
- [ ] Type check: `AccrualInputs` has zero numeric fields; `JELine.debit/credit` only constructed in `accrual.ts` math path
- [ ] Live run: Beeline-style MSA produces a plausible proposed accrual JE
- [ ] Missing-inputs path: when service end date can't be extracted, refuses with missing-field checklist
- [ ] Approve button writes audit-log entry visible in Close Cockpit
- [ ] **Accepted by:** _________ on _________

---

## UC-18 — AI-Drafted Variance Commentary (Daniel)

### Acceptance criteria

> Given current period data is available, when [reporting manager] requests variance commentary, then NOAH generates commentary for each material P&L line item comparing current vs prior period, grounded in actual transactions. ≥80% of sections accepted as-is.

### Prototype acceptance

- Narrative screen Variance Commentary tab shows 12–15 P&L lines from seed dataset
- Per-line "Generate Commentary" returns 2–3 sentences of prose grounded only in supplied numbers
- Each commentary shows: prose, key drivers bulleted, risk flags (if any), confidence score
- **No fabricated numbers** — prompt regression test verifies no number in output that wasn't in input
- Copy-to-clipboard and Accept/Edit buttons work

### Implementation mapping

| Layer | Module | Status |
|---|---|---|
| Seed data | `src/data/seed-pnl.ts` (BL.23) | ⬜ |
| Agent | `src/agents/narrative.ts::generateVarianceCommentary` (BL.24) | ⬜ |
| Adapter | `src/adapters/live-agent.ts::generateVarianceCommentary` (BL.26) | ⬜ |
| UI | `src/screens/Narrative.tsx`, `VarianceTable.tsx`, `CommentaryPanel.tsx` (BL.27) | ⬜ |
| Tests | `src/agents/narrative.test.ts` + prompt regression |  ⬜ |

### Validation checklist

- [ ] Unit test passes (mocked Qwen returns structured commentary)
- [ ] Live run produces commentary for "DTC Revenue" grounded in the seed numbers (variance, drivers match)
- [ ] Prompt regression: output contains no numeric string not present in input
- [ ] Copy/Accept actions function
- [ ] **Accepted by:** _________ on _________

---

## UC-20 — Executive Close Narrative (Sarah)

### Acceptance criteria

> Given close is complete, when [VP Controlling] requests board summary, then NOAH generates executive narrative with: close performance metrics (days, auto-cert rate), key variances, risk items, and comparison to prior periods.

### Prototype acceptance

- Narrative screen Exec Summary tab
- One-click "Generate" reads current close simulation state + top 3 variances from seed P&L + known risks
- Output card: headline, 3–5 key highlights, 1–3 risks, 1-sentence recommendation
- Board-ready tone: short, quantified, neutral
- Triggered from Close Cockpit at Gate phase via "Generate Close Narrative" button

### Implementation mapping

| Layer | Module | Status |
|---|---|---|
| Agent | `src/agents/narrative.ts::generateExecutiveSummary` (BL.25) | ⬜ |
| Adapter | `src/adapters/live-agent.ts::generateExecutiveSummary` (BL.26) | ⬜ |
| UI | `src/components/ExecSummaryCard.tsx` + Narrative tab (BL.28) | ⬜ |
| Cockpit integration | Modified `CloseCockpit.tsx` — Gate-phase button (BL.28) | ⬜ |
| Tests | `src/agents/narrative.test.ts` (exec summary case) | ⬜ |

### Validation checklist

- [ ] Unit test passes (mocked Qwen returns structured exec summary)
- [ ] Close Cockpit at Gate phase shows "Generate Close Narrative" button
- [ ] Clicking button navigates to `/narrative?tab=exec&autorun=true`
- [ ] Generated narrative renders with all four sections (headline, highlights, risks, recommendation)
- [ ] Print/copy button works
- [ ] **Accepted by:** _________ on _________

---

## UC-13, UC-14, UC-15 — Close Cycle Orchestration (Rachel — scripted)

**Scope note:** These are **scripted** in the prototype (animated simulation) — not real AI. Coverage is via the Close Cockpit port in PS-01.

### Acceptance

- Close Cockpit animates all 4 phases with 6 entities
- Event log populates as phases advance
- Gate phase triggers "Generate Close Narrative" affordance

### Implementation

| Layer | Module | Status |
|---|---|---|
| Store | `src/store/closeStore.ts` (BL.05) | ⬜ |
| Screen | `src/screens/CloseCockpit.tsx`, `PhaseGrid`, `EntityList`, `EventLog` (BL.05) | ⬜ |

### Validation checklist

- [ ] Start → phase progression visible (Pre-Close → Execute → Validate → Gate)
- [ ] Event log shows phase-change events
- [ ] Approve button in Accrual screen writes to event log (cross-UC integration)
- [ ] Gate phase exposes narrative-generation trigger (UC-20 linkage)
- [ ] **Accepted by:** _________ on _________

---

## UC-25 — Natural Language Close Queries (Rachel — scripted)

**Scope note:** Scripted Copilot chat panel with keyword routing — not a real LLM.

### Implementation

| Layer | Module | Status |
|---|---|---|
| Screen | `src/screens/CopilotPanel.tsx` (BL.06) | ⬜ |
| Data | `src/data/copilot-canned-answers.ts` | ⬜ |

### Validation checklist

- [ ] Asking "close status" returns canned answer
- [ ] Asking "exceptions" returns top 3 exceptions
- [ ] Default fallback answers unknown queries
- [ ] **Accepted by:** _________ on _________

---

## Code coverage validation

At each sprint checkpoint, run:

```powershell
pnpm test --coverage              # frontend
cd server && pnpm test --coverage # server (after test infra added)
```

### Frontend targets

| Area | Target | Rationale |
|---|---|---|
| `src/lib/accrual-math.ts` | **100%** | JE correctness is non-negotiable |
| `src/lib/je-builder.ts` | **100%** | Debits = credits invariant |
| `src/lib/api-client.ts` | ≥60% | Network error handling paths |
| `src/agents/*` | ≥70% | Branches around bad-JSON retries, low-confidence fallbacks |
| `src/adapters/*` | ≥60% | Mostly glue, some event-emission paths |
| `src/screens/*` | Not required | Visual/E2E via Playwright instead |
| `src/store/*` | ≥50% | State reducers unit-testable |

### Server targets

| Area | Target | Rationale |
|---|---|---|
| `server/src/lib/ingest.ts` | ≥85% | File-type dispatch + error branches |
| `server/src/lib/embeddings.ts` | ≥75% | Dim-mismatch, empty-input, HTTP error paths |
| `server/src/routes/contracts.ts` | ≥70% | Upload happy + dedup + validation paths |
| `server/src/routes/search.ts` | ≥65% | Zod validation, empty-embedding edge case |
| `server/src/routes/metabase.ts` | ≥60% | PATCH builder, 404 path |
| `server/src/routes/audit.ts` | ≥50% | Thin glue; integration tests more valuable |

### Per-checkpoint record

| Checkpoint | Date | FE unit | Server unit | E2E pass |
|---|---|---|---|---|
| PS-00 | — | n/a | — | infra smoke |
| PS-01 | — | — | — | — |
| PS-02 | — | — | — | — |
| PS-03 | — | — | — | — |
| PS-04 | — | — | — | — |
| PS-05 | — | — | — | — |
| PS-06 | — | — | — | — |
| PS-Final | — | — | — | — |

---

## User Acceptance Test Scripts

Four end-to-end UAT scripts to run for stakeholder sign-off. Each is deterministic in **canned mode** (Acme theme) and real in **live mode** (Nike theme with Qwen).

### UAT-1 — Contract Review to Proposed JE (covers UC-07, UC-08, UC-09, UC-10)

**Preconditions:** App running; contract `Contract_2_Professional_Services_Outsourcing.docx` available (samples/acme in canned; samples/user in live).

**Steps:**
1. Navigate to `/contracts`
2. Drag-drop the contract onto the queue
3. Wait for Agent Activity Strip to complete all four steps (Extract → Risk → Tech-Acct → [stop, manual])
4. Observe attribute checklist populated; click any field to see source page
5. Verify risk badge (expected: Medium or High)
6. Verify technical accounting flags (expected: no lease, no derivative, straight-line expense method)
7. Click "Propose Accrual"
8. Observe calc detail panel with service dates, fee schedule, and computed accrual
9. Verify JE card shows debits = credits, reversal = 1st of next month
10. Click Approve
11. Navigate back to `/` — verify audit event in Close Cockpit event log

**Expected result:** Full agentic chain visible, believable, deterministic math. Approval event logged.

### UAT-2 — Demo Moment 2 Auto Playback (covers UC-07, UC-08, UC-09 visual)

**Preconditions:** App running in live mode.

**Steps:**
1. Navigate to `/contracts`
2. Pre-select `Contract_5_AWS_Enterprise.docx` for review
3. Toggle "Auto" mode
4. Click each step in Agent Activity Strip → verify Behind-the-Scenes modal shows actions, systems, outputs, handoff
5. Click Play on Auto mode — observe steps light up with green pulse
6. Time the full sequence — target 2:45–3:15

**Expected result:** Clean 3-minute walk through 8 steps matching Demo Experience Guide. Presenter can narrate alongside.

### UAT-3 — Variance Commentary + Executive Narrative (covers UC-18, UC-20)

**Preconditions:** App running.

**Steps:**
1. Navigate to `/narrative` — Variance Commentary tab
2. Click "Generate" on DTC Revenue line
3. Verify commentary renders: 2–3 sentences, grounded in $135M variance, 5% growth
4. Verify drivers bulleted, risk flags appear if present
5. Click Copy-to-Clipboard — verify clipboard contains prose
6. Click "Generate All" — verify progress through remaining lines
7. Switch to Exec Summary tab
8. Click "Generate" (or trigger from Close Cockpit Gate phase)
9. Verify exec card: headline, 3–5 highlights, risks, recommendation
10. Verify tone — short, quantified, board-ready

**Expected result:** Two distinct narrative outputs. No numbers fabricated. Copyable/usable.

### UAT-4 — Metabase Semantic Search (covers PS-00 infra end-to-end)

**Preconditions:** Docker up, server running, `pnpm seed` has loaded the 5 Acme contracts.

**Steps:**

1. Call `POST /api/search/semantic` with `{"query": "commercial lease for data center", "limit": 3}`
2. Verify top result is a lease-adjacent contract (Construction Retail Remodel or similar real-estate-flavored sample)
3. Call `POST /api/search/semantic` with `{"query": "advertising and marketing campaign services", "limit": 3}`
4. Verify top result is `Contract_1_Advertising_Campaign`
5. Call `POST /api/search/semantic` with `{"query": "cloud computing subscription"}`
6. Verify top result is `Contract_5_AWS_Enterprise`
7. Call `POST /api/search/similar/:contractId` using Contract_2's ID
8. Verify response returns up to 4 other contracts, excluding Contract_2 itself
9. Call `GET /api/search/attributes?counterparty=Amazon%20Web%20Services` (after attribute extraction runs)
10. Verify Contract_5 appears in results

**Expected result:** Three distinct semantic queries each rank the "right" contract at position 1. Similar-to-this excludes the source. Structured filter works against JSONB column.

### UAT-5 — Audit trail persistence (covers UC-23 scaffolding, PS-00)

**Preconditions:** Server running, at least one contract seeded.

**Steps:**

1. Upload a new contract via `POST /api/contracts`
2. Call `GET /api/audit?contract_id={newId}&limit=10`
3. Verify response includes an `event_type: "upload"` row with correct `contract_id`, `agent: "ingest"`, timestamp
4. (After agent UI lands) Approve an accrual in the frontend
5. Query audit again — expect 2+ events including `event_type: "approve"`
6. Delete the contract
7. Query audit — upload/approve events remain (with `contract_id` nulled via `ON DELETE SET NULL`)

**Expected result:** Every significant action produces an audit row. Row survives contract deletion (audit log is append-only, not cascade-deleted).

---

## Sign-off log

| UAT | Date | Reviewer | Mode | Pass? | Notes |
|---|---|---|---|---|---|
| UAT-1 Contract→JE | — | — | — | — | — |
| UAT-2 Auto playback | — | — | — | — | — |
| UAT-3 Narrative | — | — | — | — | — |
| UAT-4 Semantic search | — | — | — | — | — |
| UAT-5 Audit trail | — | — | — | — | — |

---

## Change log

| Date | Change | By |
|---|---|---|
| 2026-04-21 | Initial creation from DESIGN.md + roadmap.md | Claude |
| 2026-04-21 | Added PS-00 infra section (BL.38–BL.45 per-item acceptance), server code coverage targets, UAT-4 semantic search, UAT-5 audit trail | Claude |
