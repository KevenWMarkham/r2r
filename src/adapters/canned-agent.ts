import { getFixtureContract, getFixtureVarianceCommentary, getFixtureExecutiveSummary } from "@/lib/fixtures";
import type { ContractAttributes } from "@/agents/contract-schema";
import type { RiskResult } from "@/agents/risk";
import type { TechAccountingFlags } from "@/agents/tech-accounting";
import { AccrualGapError, type AccrualPipelineResult } from "@/agents/accrual";
import type { AccrualInputs } from "@/agents/accrual-inputs";
import type { VarianceCommentary, ExecutiveSummary, ExecInputs } from "@/agents/narrative";
import type { PnLLine } from "@/data/seed-pnl";
import type { Agent, AgentCallbacks, AgentStep, ExtractOutcome } from "./agent-interface";
import type { ProposedJE } from "@/lib/je-builder";
import type { AccrualCalcResult } from "@/lib/accrual-math";

// Artificial per-step dwell. Tuned to mimic a real Claude API call so the
// canned demo "feels" like the live Anthropic backend (~1.5-2s per step,
// ~6-8s for the full 4-step extract → risk → tech-acct → accrual chain).
// Real Ollama/Qwen on a laptop runs ~30-90s per contract — too slow for live demo.
const DWELL_MS_MIN = 1200;
const DWELL_MS_MAX = 2200;

function dwell(): Promise<void> {
  const ms = DWELL_MS_MIN + Math.random() * (DWELL_MS_MAX - DWELL_MS_MIN);
  return new Promise((r) => setTimeout(r, ms));
}

export class CannedAgent implements Agent {
  async extractAttributes(
    contractId: string,
    _fullText: string,
    cb?: AgentCallbacks
  ): Promise<ExtractOutcome> {
    return this.replay("extract", cb, async () => {
      const c = getFixtureContract(contractId);
      if (!c || !c.attributes) {
        throw new Error(`No fixture for contract id=${contractId}. Only bundled Acme samples are available in canned mode.`);
      }
      return {
        attributes: c.attributes as unknown as ContractAttributes,
        degraded: false,
      };
    });
  }

  async scoreRisk(
    contractId: string,
    _attributes: ContractAttributes,
    _fullText: string,
    cb?: AgentCallbacks
  ): Promise<RiskResult> {
    return this.replay("risk", cb, async () => {
      const c = getFixtureContract(contractId);
      if (!c || c.risk_score == null || !c.risk_category) {
        throw new Error(`No risk fixture for contract id=${contractId}.`);
      }
      return {
        score: c.risk_score,
        category: c.risk_category as RiskResult["category"],
        reasons: (c.risk_reasons as unknown as string[] | null) ?? [],
      };
    });
  }

  async flagTechnicalAccounting(
    contractId: string,
    _attributes: ContractAttributes,
    _fullText: string,
    cb?: AgentCallbacks
  ): Promise<TechAccountingFlags> {
    return this.replay("techAcct", cb, async () => {
      const c = getFixtureContract(contractId);
      if (!c || !c.tech_acct_flags) {
        throw new Error(`No tech-acct fixture for contract id=${contractId}.`);
      }
      return c.tech_acct_flags as unknown as TechAccountingFlags;
    });
  }

  async calculateAccrual(
    contractId: string,
    _counterparty: string,
    _attributes: ContractAttributes,
    _fullText: string,
    _opts?: { periodEnd?: Date; billedToDate?: number },
    cb?: AgentCallbacks
  ): Promise<AccrualPipelineResult> {
    return this.replay("accrual", cb, async () => {
      const c = getFixtureContract(contractId);
      if (!c) {
        throw new Error(`No fixture for contract id=${contractId}. Only bundled Acme samples are available in canned mode.`);
      }
      // Future-dated contracts (service start > current period) legitimately have
      // no proposed_je yet — surface as AccrualGapError so the AccrualProposal
      // screen renders the friendly "Cannot compute" panel instead of an error toast.
      if (!c.proposed_je || !c.accrual_detail) {
        const start = (c.attributes as Record<string, { value?: unknown }> | null)?.service_start_date?.value as string | undefined;
        if (start) {
          throw new AccrualGapError([
            `Service start date ${start} is after current period end (2026-04-30) — no accrual recognized this period.`,
          ]);
        }
        throw new AccrualGapError(["Accrual inputs not yet seeded for this fixture."]);
      }
      return {
        inputs: c.accrual_detail.inputs as AccrualInputs,
        calc: c.accrual_detail.calc as AccrualCalcResult,
        je: c.proposed_je as unknown as ProposedJE,
        missing: [],
      };
    });
  }

  async generateVarianceCommentary(
    line: PnLLine,
    cb?: AgentCallbacks
  ): Promise<VarianceCommentary> {
    return this.replay("narrative-variance", cb, async () => {
      const fixture = getFixtureVarianceCommentary(line.id);
      if (!fixture) {
        return {
          commentary: `No canned commentary available for ${line.lineItem}.`,
          key_drivers: [line.driver],
          risk_flags: ["Canned mode — fixture missing"],
          confidence: 0,
        };
      }
      return fixture;
    });
  }

  async generateExecutiveSummary(
    _inputs: ExecInputs,
    cb?: AgentCallbacks
  ): Promise<ExecutiveSummary> {
    return this.replay("narrative-exec", cb, async () => getFixtureExecutiveSummary());
  }

  // ── Internal: replay helper with step events + dwell ─────────────────────
  private async replay<T>(
    step: AgentStep,
    cb: AgentCallbacks | undefined,
    body: () => Promise<T>
  ): Promise<T> {
    const startedAt = Date.now();
    cb?.onEvent?.({ step, status: "start", startedAt });
    await dwell();
    try {
      const outcome = await body();
      cb?.onEvent?.({ step, status: "done", finishedAt: Date.now() });
      return outcome;
    } catch (e) {
      cb?.onEvent?.({ step, status: "error", finishedAt: Date.now(), detail: String(e) });
      throw e;
    }
  }
}
