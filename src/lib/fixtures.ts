// Fixture loader for canned mode. JSON imported at build time so Pages ships
// a fully self-contained bundle — no server, no LLM, no network.

import metabaseFixtures from "../../fixtures/metabase.json";
import narrativeFixtures from "../../fixtures/narratives.json";
import type { ContractSummary, ContractDetail } from "./api-client";
import type { VarianceCommentary, ExecutiveSummary } from "@/agents/narrative";

interface FixtureContract extends ContractDetail {
  accrual_detail?: {
    inputs: unknown;
    calc: unknown;
  };
}

const contracts = (metabaseFixtures.contracts as unknown as FixtureContract[]);

export function getFixtureContracts(): ContractSummary[] {
  return contracts.map((c) => ({
    id: c.id,
    filename: c.filename,
    file_type: c.file_type,
    byte_size: c.byte_size,
    source: c.source,
    uploaded_at: c.uploaded_at,
    updated_at: c.updated_at,
    counterparty: c.counterparty,
    tcv: c.tcv,
    lease_flagged: c.lease_flagged,
    derivative_flagged: c.derivative_flagged,
    risk_score: c.risk_score,
    risk_category: c.risk_category,
    agent_status: c.agent_status ?? {},
  }));
}

export function getFixtureContract(id: string): FixtureContract | null {
  const c = contracts.find((c) => c.id === id);
  if (!c) return null;
  // The canned fixtures intentionally don't bundle the full contract text
  // (it bloats the bundle by ~150KB × 11). The agent screens guard on
  // `contract.full_text` before running the agent chain — a missing value
  // would silently disable every "Run / Risk / Tech-Acct / Compute" button.
  // The canned agent doesn't actually read full_text, so a synthetic stub
  // unblocks the buttons without changing behavior.
  if (!c.full_text) {
    return {
      ...c,
      full_text: `[Canned-mode stub] Contract: ${c.filename}\nCounterparty: ${c.counterparty ?? "n/a"}\nTCV: ${c.tcv ?? "n/a"}\n\nFull document text is omitted in canned mode for bundle-size reasons. Live mode (VITE_MODE=live) loads the real contract text from Postgres.`,
    };
  }
  return c;
}

export function getFixtureVarianceCommentary(lineId: string): VarianceCommentary | null {
  const entry = (narrativeFixtures.variance as Record<string, VarianceCommentary>)[lineId];
  return entry ?? null;
}

export function getFixtureExecutiveSummary(): ExecutiveSummary {
  return narrativeFixtures.exec as ExecutiveSummary;
}
