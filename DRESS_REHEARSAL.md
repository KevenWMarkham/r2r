# NOAH Prototype — Dress Rehearsal Checklist

Run this on a **fresh Windows laptop** before any client demo. Target: < 5 min to first useful screen.

## Pre-flight

- [ ] Laptop has ≥16 GB RAM (Qwen 7B + Docker Desktop is ~8 GB resident)
- [ ] Free ports: 5173, 3001, 5434, 11434
- [ ] `git` installed
- [ ] Internet available for first-time dependency installs

## Install (one-time, ~15 min)

- [ ] `winget install pnpm`
- [ ] `winget install Ollama.Ollama`
- [ ] `winget install Docker.DockerDesktop`
- [ ] Start Docker Desktop, wait for green
- [ ] `ollama pull qwen2.5:7b` (~5 GB)
- [ ] `ollama pull nomic-embed-text` (~275 MB)
- [ ] `git clone <repo-url>` the Prototype

## Clean start (every demo, ~2 min)

- [ ] `cd Prototype`
- [ ] `docker compose up -d postgres` → wait for `noah-postgres` healthy
- [ ] `cd server && pnpm install && pnpm dev &`
- [ ] `cd .. && pnpm install && pnpm dev`
- [ ] Browser: http://localhost:5173 → Nike theme loads

## Seed + smoke (first time only, ~15 min — most is Qwen)

- [ ] `cd server && pnpm seed` → expect 5 contracts ingested
- [ ] `curl http://localhost:3001/health` → `{ ok: true, db: "connected" }`
- [ ] `curl -X POST http://localhost:3001/api/search/semantic -H 'Content-Type: application/json' -d '{"query":"advertising","limit":3}'` → Contract_1 ranks first
- [ ] Warm Qwen: `ollama run qwen2.5:7b "hi"` (loads weights into memory)
- [ ] Run extractor once on Contract_1 via UI — get coffee (extraction ~5 min on CPU)

## The 60-second demo

1. [ ] `/` — Close Cockpit → **Start** → phases animate → narrate
2. [ ] `/contracts` — 5 contracts with risk badges visible
3. [ ] Click Contract_1 → **Run full chain** → Agent Activity Strip animates → click Extract step → Behind-the-Scenes modal opens
4. [ ] Attributes panel populates (Wieden+Kennedy, $8.4M, monthly billing, straight-line)
5. [ ] Click **→ Accrual** → **Compute accrual** → JE card: DR 6810 Services Expense $350,000 / CR 2310 Accrued Liabilities $350,000
6. [ ] **Approve** → toast → event log on Cockpit updates
7. [ ] `/narrative` → Variance Commentary → click **Generate** on DTC Revenue → prose renders grounded in $135M / +5%
8. [ ] Switch to Executive Summary → **Generate** → board-ready card

## Pages (canned) demo — separate laptop

- [ ] Open public Pages URL → Acme theme loads
- [ ] 5 contracts pre-analyzed; click AWS Enterprise → ASC 815 derivative flag visible
- [ ] Narrative → commentaries instant (fixture replay, ~500ms per step)

## Safety

- [ ] `ModeBanner` visible → press `Ctrl+Shift+D` to hide for clean demo
- [ ] No files in `samples/user/` checked into git: `git log --all -- samples/user/ | head` → empty
- [ ] Pre-commit hook active: `ls .husky/pre-commit` and it's executable
- [ ] Ollama running before opening `/contracts` (otherwise OllamaGuard modal)

## Rollback plan

- [ ] If demo crashes mid-live: switch tab to **canned** Pages URL as fallback
- [ ] Spare laptop with everything pre-warmed
- [ ] Recorded demo video on file (in case Ollama crashes on stage)

## Known quirks / talking points

- **Extraction takes minutes** in live mode — explain: "CPU Qwen 7B; in production this runs on Azure AI Foundry with GPU inference." Pages demo shows the instant equivalent.
- **Empty semantic search with ivfflat** — we use HNSW; if someone sees this during install, drop and recreate the index.
- **Only 5 contracts** in the Pages demo — add more via `pnpm seed` + `pnpm tsx src/scripts/generate-fixtures.ts`.

## Sign-off

| | Name | Date |
|---|---|---|
| Rehearsal led by | | |
| Backup presenter | | |
| Go/no-go for client demo | | |
