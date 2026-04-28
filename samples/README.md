# Samples

This folder holds the contract documents used by the prototype.

## `samples/acme/` — Public demo contracts (committed)

Eleven synthetic-but-realistic contracts. Each runs the full agent chain (extract → risk → tech-acct → accrual) with a posted JE for current period 2026-04. Together they exercise every demo path in the prototype: straight-line, prepaid amortization, milestone CIP capex, ASC 842 lease, and ASC 815 embedded-derivative senior review.

| File | Counterparty | April JE | Exercises |
|---|---|---|---|
| `Contract_0_Meridian_Golden.docx` | Meridian Solutions Inc. | $500K | Golden MSA · 100% extraction · straight-line $500K/mo |
| `Contract_1_Advertising_Campaign.docx` | Wieden+Kennedy (creative agency) | $350K | Straight-line accrual · exclusivity-clause risk |
| `Contract_2_Professional_Services_Outsourcing.docx` | Accenture (BPO) | $667K | Auto-renewal · vendor-concentration risk |
| `Contract_3_Insurance_MultiYear.docx` | Chubb (P&C insurance) | $417K | Prepaid amortization · multi-year |
| `Contract_4_Construction_Retail_Remodel.docx` | Turner Construction | $2.5M | Milestone CIP capex · direct-association |
| `Contract_5_AWS_Enterprise.docx` | Amazon Web Services | $1.25M | **ASC 815 embedded derivative** (CPI escalator) |
| `Golden_A_TechFlow_MSA.docx` | TechFlow Consulting LLC | $100K | Clean tech-advisory MSA · low risk |
| `Golden_B_Nexus_SaaS_Renewal.docx` | Nexus Cloud Inc. | $37.5K | **ASC 815 embedded derivative** (CPI-U capped) · senior review |
| `Golden_C_Atlas_Office_Lease.docx` | Atlas Realty Partners, LP | $60K | **ASC 842 operating lease** · ROU asset · senior review |
| `Golden_D_Summit_Construction_Buildout.docx` | Summit Builders LLC | $850K | Milestone certification · CIP capex · 5 performance obligations |
| `Golden_E_Olympic_Insurance_MultiYear.docx` | Olympic Insurance Group | $62.5K | Multi-year P&C · prepaid amortization |

All eleven ship in `fixtures/metabase.json` with pre-populated agent outputs for the public Pages demo (canned mode). Live mode (Ollama or Claude API) re-extracts against the actual document text.

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
