import type { ContractAttributes } from "@/agents/contract-schema";
import type { RiskResult } from "@/agents/risk";
import type { TechAccountingFlags } from "@/agents/tech-accounting";
import type { AccrualPipelineResult } from "@/agents/accrual";

export type AgentStep =
  | "extract"
  | "risk"
  | "techAcct"
  | "accrual"
  | "narrative-variance"
  | "narrative-exec";

export type AgentStatus = "idle" | "start" | "done" | "error";

export interface AgentEvent {
  step: AgentStep;
  status: AgentStatus;
  detail?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface AgentCallbacks {
  onEvent?: (e: AgentEvent) => void;
}

export interface ExtractOutcome {
  attributes: ContractAttributes;
  degraded: boolean;
  warning?: string;
}

export interface Agent {
  /** UC-07 — 27-attribute extraction. Persists to metabase + writes audit event. */
  extractAttributes(
    contractId: string,
    fullText: string,
    cb?: AgentCallbacks
  ): Promise<ExtractOutcome>;

  /** UC-08 — Risk scoring (rules + LLM signal). */
  scoreRisk(
    contractId: string,
    attributes: ContractAttributes,
    fullText: string,
    cb?: AgentCallbacks
  ): Promise<RiskResult>;

  /** UC-09 — ASC 840/842 lease + ASC 815 derivative + expense method classification. */
  flagTechnicalAccounting(
    contractId: string,
    attributes: ContractAttributes,
    fullText: string,
    cb?: AgentCallbacks
  ): Promise<TechAccountingFlags>;

  /** UC-10 — Accrual extraction + deterministic math + proposed JE. */
  calculateAccrual(
    contractId: string,
    counterparty: string,
    attributes: ContractAttributes,
    fullText: string,
    opts?: { periodEnd?: Date; billedToDate?: number },
    cb?: AgentCallbacks
  ): Promise<AccrualPipelineResult>;
}
