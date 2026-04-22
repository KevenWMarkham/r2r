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
  return contracts.find((c) => c.id === id) ?? null;
}

export function getFixtureVarianceCommentary(lineId: string): VarianceCommentary | null {
  const entry = (narrativeFixtures.variance as Record<string, VarianceCommentary>)[lineId];
  return entry ?? null;
}

export function getFixtureExecutiveSummary(): ExecutiveSummary {
  return narrativeFixtures.exec as ExecutiveSummary;
}
