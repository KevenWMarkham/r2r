# Samples

This folder holds the contract documents used by the prototype.

## `samples/acme/` — Public demo contracts (committed)

Five synthetic-but-realistic contracts representing distinct agent behaviors:

| File | Counterparty | Exercises |
|---|---|---|
| `Contract_1_Advertising_Campaign.docx` | Wieden+Kennedy (creative agency) | Straight-line accrual, exclusivity-clause risk |
| `Contract_2_Professional_Services_Outsourcing.docx` | Accenture (BPO) | Auto-renewal, vendor-concentration risk, monthly accrual |
| `Contract_3_Insurance_MultiYear.docx` | Chubb (P&C insurance) | Prepaid-expense amortization, multi-year |
| `Contract_4_Construction_Retail_Remodel.docx` | Turner Construction | Milestone-based direct-association accrual, CIP capex |
| `Contract_5_AWS_Enterprise.docx` | Amazon Web Services | **ASC 815 embedded derivative** (CPI escalator), auto-renewal, data-sovereignty |

These ship in `fixtures/metabase.json` with pre-populated agent outputs for the public Pages demo (canned mode).

## `samples/user/` — Your own contracts (gitignored)

Anything you drop in `samples/user/` is **gitignored** — useful for running live-mode extraction against your own documents without committing them.

- Accepted formats: `.pdf` and `.docx`
- Uploaded via the Contract Queue UI (live mode) → server extracts + embeds + stores in Postgres

A `.gitkeep` is committed so the directory exists on fresh clones.

## Adding new samples to the Acme public set

1. Drop the file into `samples/acme/` (PDF or DOCX).
2. From the `Prototype/` root:
   ```powershell
   docker compose up -d postgres
   cd server
   pnpm seed                    # ingest all samples into Postgres
   pnpm tsx src/scripts/generate-fixtures.ts   # re-extract via Qwen (25-30 min)
   ```
3. Review `fixtures/metabase.json.generated`, rename to `metabase.json`, commit.
