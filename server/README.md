# NOAH Prototype — Server

Node/Express backend providing:

- **Contract blob storage** — uploaded `.pdf`/`.docx` files stored as `bytea` in PostgreSQL
- **Metabase** — structured metadata catalog (extracted attributes, risk, tech-acct flags, proposed JE, narrative) with JSONB and a vector embedding column
- **Semantic search** — nearest-neighbor over `nomic-embed-text` 768-dim embeddings via pgvector
- **Audit trail** — per-agent event log (UC-23/UC-24 scaffolding)

## Prereqs

- Docker (for Postgres+pgvector container)
- Node 20+
- Ollama running with two models pulled:
  ```powershell
  ollama pull qwen2.5:7b
  ollama pull nomic-embed-text
  ```

## Quick start

```powershell
# From Prototype/ root:
docker compose up -d postgres       # starts Postgres+pgvector on :5434
cd server
cp .env.example .env                # edit if needed
pnpm install
pnpm dev                            # server on :3001, hot reload
```

Smoke test:

```powershell
curl http://localhost:3001/health
```

## Seed samples

After server starts, seed the 5 Acme sample contracts from `../samples/acme/`:

```powershell
pnpm seed
```

This extracts text + embeds each contract + inserts into `contracts` and `contract_metabase`.

## API

| Method | Path | Description |
|---|---|---|
| GET  | `/health` | DB + server health |
| GET  | `/api/contracts` | List all contracts (summary view) |
| GET  | `/api/contracts/:id` | Single contract with full metabase |
| GET  | `/api/contracts/:id/blob` | Stream the original file |
| POST | `/api/contracts` | Upload (multipart `file` field) — extract, embed, insert |
| DELETE | `/api/contracts/:id` | Remove contract (cascade to metabase) |
| PATCH | `/api/metabase/:contractId` | Update structured metadata as agents complete |
| GET  | `/api/metabase` | Full metabase dump (no blobs) |
| POST | `/api/search/semantic` | NN search via embedding; body: `{query, limit}` |
| POST | `/api/search/similar/:contractId` | Contracts similar to a given one |
| GET  | `/api/search/attributes?key=value` | Structured JSONB filter |
| POST | `/api/audit` | Record an event |
| GET  | `/api/audit?contract_id=…` | Event history |

## Schema

See [`../docker/init.sql`](../docker/init.sql). Key tables:

- `contracts` — bytea blob + sha256 + uploaded_at
- `contract_metabase` — 1:1 to contracts; attributes (JSONB), risk, tech-acct-flags, full_text, embedding `VECTOR(768)`, proposed_je, narrative, agent_status
- `audit_events` — append-only event log
- `pnl_lines` — seed P&L for narrative agent

## Admin UI

```powershell
docker compose --profile tools up -d adminer
# http://localhost:8081  —  System: PostgreSQL · Server: postgres · User/Pass: noah · DB: noah
```
