import type { AccrualInputs } from "@/agents/accrual-inputs";
import type { AccrualCalcResult } from "@/lib/accrual-math";
import type { ProposedJE } from "@/lib/je-builder";
import { Link as LinkIcon } from "lucide-react";

interface Props {
  inputs: AccrualInputs;
  calc: AccrualCalcResult;
  je: ProposedJE;
}

export default function CalcDetailPanel({ inputs, calc, je }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
          Extracted Inputs (strings/dates only)
        </div>
        <div className="space-y-1 text-xs font-mono">
          <Row k="Total fee" v={inputs.total_fee_amount_string || "—"} />
          <Row k="Currency" v={inputs.currency || "—"} />
          <Row k="Service start" v={inputs.service_start_date || "—"} />
          <Row k="Service end" v={inputs.service_end_date || "—"} />
          <Row k="Billing frequency" v={inputs.billing_frequency} />
          <Row k="Expense method" v={inputs.expense_recognition_method} />
          <Row k="Fee schedule" v={inputs.fee_schedule_description || "—"} />
        </div>
      </div>

      <div className="pt-4 border-t border-brand-border">
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
          Computation (deterministic TS math)
        </div>
        <div className="bg-black/40 border border-brand-border p-3 font-mono text-[11px] text-brand-text-muted leading-relaxed space-y-1">
          <div>
            Monthly rate:{" "}
            <span className="text-brand-text">
              {calc.monthlyRate != null ? `$${calc.monthlyRate.toLocaleString()}` : "(milestone-based — no monthly rate)"}
            </span>
          </div>
          <div>
            Service months:{" "}
            <span className="text-brand-text">{(calc.serviceMonths ?? 0).toFixed(1)}</span>
          </div>
          <div>
            Months elapsed:{" "}
            <span className="text-brand-text">{(calc.monthsElapsed ?? 0).toFixed(1)}</span>
          </div>
          <div>
            Cumulative earned:{" "}
            <span className="text-brand-text">
              ${(calc.accruedCumulative ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="pt-1 border-t border-brand-border/60 mt-1">
            Period accrual:{" "}
            <span className="text-brand-accent font-bold">
              ${(calc.periodAccrual ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="text-xs text-brand-text-muted mt-2 leading-relaxed italic">
          {calc.reasoning}
        </div>
      </div>

      {je.clauseRefs.length > 0 && (
        <div className="pt-4 border-t border-brand-border">
          <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
            Clause Traceability
          </div>
          <ul className="space-y-1 text-xs">
            {je.clauseRefs.map((ref, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-brand-text-muted font-mono"
              >
                <LinkIcon size={11} className="text-brand-text-dim" />
                <span>{ref.field}</span>
                <span className="text-brand-accent">
                  {ref.page !== null ? `p. ${ref.page}` : "(no page)"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-brand-border/40 py-0.5">
      <span className="text-brand-text-dim uppercase tracking-wider text-[10px]">{k}</span>
      <span className="text-brand-text text-right truncate max-w-[60%]">{v}</span>
    </div>
  );
}
