import { extractAttributes as runExtract } from "@/agents/extractor";
import { scoreRisk as runScoreRisk } from "@/agents/risk";
import { flagTechnicalAccounting as runFlagTech } from "@/agents/tech-accounting";
import { runAccrualPipeline, AccrualGapError, type AccrualPipelineResult } from "@/agents/accrual";
import { patchMetabase, recordAudit } from "@/lib/api-client";
import type { ContractAttributes } from "@/agents/contract-schema";
import type { RiskResult } from "@/agents/risk";
import type { TechAccountingFlags } from "@/agents/tech-accounting";
import type { Agent, AgentCallbacks, AgentStep, ExtractOutcome } from "./agent-interface";

export class LiveAgent implements Agent {
  async extractAttributes(
    contractId: string,
    fullText: string,
    cb?: AgentCallbacks
  ): Promise<ExtractOutcome> {
    return this.runStep("extract", cb, async () => {
      const { attributes, degraded, warning } = await runExtract(fullText);
      await patchMetabase(contractId, {
        attributes: attributes as Record<string, unknown>,
        agent_status: { extract: degraded ? "partial" : "done" },
      });
      await recordAudit({
        event_type: "extract",
        contract_id: contractId,
        agent: "extractor",
        confidence: avgConfidence(attributes),
        payload: { degraded, warning },
      }).catch(() => undefined);
      return { outcome: { attributes, degraded, warning }, doneAsError: degraded, detail: warning };
    });
  }

  async scoreRisk(
    contractId: string,
    attributes: ContractAttributes,
    fullText: string,
    cb?: AgentCallbacks
  ): Promise<RiskResult> {
    return this.runStep("risk", cb, async () => {
      const result = await runScoreRisk(attributes, fullText);
      await patchMetabase(contractId, {
        risk_score: result.score,
        risk_category: result.category,
        risk_reasons: result.reasons,
        agent_status: { risk: "done" },
      });
      await recordAudit({
        event_type: "risk",
        contract_id: contractId,
        agent: "risk",
        payload: { score: result.score, category: result.category },
      }).catch(() => undefined);
      return { outcome: result };
    });
  }

  async flagTechnicalAccounting(
    contractId: string,
    attributes: ContractAttributes,
    fullText: string,
    cb?: AgentCallbacks
  ): Promise<TechAccountingFlags> {
    return this.runStep("techAcct", cb, async () => {
      const result = await runFlagTech(fullText, attributes);
      await patchMetabase(contractId, {
        tech_acct_flags: result as unknown as Record<string, unknown>,
        agent_status: { techAcct: "done" },
      });
      await recordAudit({
        event_type: "tech_acct",
        contract_id: contractId,
        agent: "tech-accounting",
        payload: {
          lease: result.lease.flagged,
          derivative: result.derivative.flagged,
          method: result.expense_method,
          senior_review: result.requires_senior_review,
        },
      }).catch(() => undefined);
      return { outcome: result };
    });
  }

  async calculateAccrual(
    contractId: string,
    counterparty: string,
    attributes: ContractAttributes,
    fullText: string,
    opts?: { periodEnd?: Date; billedToDate?: number },
    cb?: AgentCallbacks
  ): Promise<AccrualPipelineResult> {
    return this.runStep("accrual", cb, async () => {
      try {
        const result = await runAccrualPipeline(attributes, fullText, {
          contractId,
          counterparty,
          periodEnd: opts?.periodEnd,
          billedToDate: opts?.billedToDate,
        });
        await patchMetabase(contractId, {
          proposed_je: result.je as unknown as Record<string, unknown>,
          agent_status: { accrual: "done" },
        });
        await recordAudit({
          event_type: "accrual",
          contract_id: contractId,
          agent: "accrual",
          payload: {
            period_accrual: result.calc.periodAccrual,
            total_debits: result.je.totalDebits,
            reversal_date: result.je.reversalDate,
          },
        }).catch(() => undefined);
        return { outcome: result };
      } catch (e) {
        if (e instanceof AccrualGapError) {
          await patchMetabase(contractId, {
            agent_status: { accrual: "missing_inputs" },
          }).catch(() => undefined);
        }
        throw e;
      }
    });
  }

  // ── Internal: step-wrapping with event emission + error handling ───────────
  private async runStep<T>(
    step: AgentStep,
    cb: AgentCallbacks | undefined,
    body: () => Promise<{ outcome: T; doneAsError?: boolean; detail?: string }>
  ): Promise<T> {
    const startedAt = Date.now();
    cb?.onEvent?.({ step, status: "start", startedAt });
    try {
      const { outcome, doneAsError, detail } = await body();
      cb?.onEvent?.({
        step,
        status: doneAsError ? "error" : "done",
        finishedAt: Date.now(),
        detail,
      });
      return outcome;
    } catch (e) {
      cb?.onEvent?.({ step, status: "error", finishedAt: Date.now(), detail: String(e) });
      throw e;
    }
  }
}

function avgConfidence(attrs: Record<string, { confidence: number }>): number {
  const vals = Object.values(attrs).map((f) => f.confidence);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
