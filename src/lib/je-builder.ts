import type { AccrualCalcResult } from "./accrual-math";

export interface JELine {
  account: string;
  accountName: string;
  debit: number;  // dollars
  credit: number; // dollars
}

export interface ClauseRef {
  field: string;
  page: number | null;
  snippet?: string;
}

export interface ProposedJE {
  id: string;
  contractId: string;
  period: string;              // "YYYY-MM"
  description: string;
  lines: JELine[];
  totalDebits: number;
  totalCredits: number;
  reversalDate: string;        // ISO date
  supportingCalc: string;
  clauseRefs: ClauseRef[];
}

function firstOfNextMonth(d: Date): Date {
  const n = new Date(d);
  n.setMonth(n.getMonth() + 1, 1);
  n.setHours(0, 0, 0, 0);
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface JEBuildInput {
  contractId: string;
  counterparty: string;
  periodEnd: Date;
  calc: AccrualCalcResult;
  /** Override the default GL accounts (defaults to 6810/2310 for services expense + accrued liability). */
  expenseAccount?: { code: string; name: string };
  liabilityAccount?: { code: string; name: string };
  clauseRefs?: ClauseRef[];
}

export function buildAccrualJE(input: JEBuildInput): ProposedJE {
  const amount = round2(input.calc.periodAccrual);
  const expenseAccount =
    input.expenseAccount ?? { code: "6810", name: "Services Expense" };
  const liabilityAccount =
    input.liabilityAccount ?? { code: "2310", name: "Accrued Liabilities" };

  const lines: JELine[] = [
    { account: expenseAccount.code, accountName: expenseAccount.name, debit: amount, credit: 0 },
    { account: liabilityAccount.code, accountName: liabilityAccount.name, debit: 0, credit: amount },
  ];

  const totalDebits = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredits = lines.reduce((s, l) => s + l.credit, 0);

  // Invariant: debits = credits (enforced here; any drift = bug)
  if (round2(totalDebits) !== round2(totalCredits)) {
    throw new Error(
      `JE builder invariant violated: debits ${totalDebits} != credits ${totalCredits}`
    );
  }

  const periodStr = `${input.periodEnd.getFullYear()}-${String(
    input.periodEnd.getMonth() + 1
  ).padStart(2, "0")}`;

  return {
    id: `JE-${input.contractId.slice(0, 8)}-${periodStr}`,
    contractId: input.contractId,
    period: periodStr,
    description: `Accrual — ${input.counterparty}`,
    lines,
    totalDebits: round2(totalDebits),
    totalCredits: round2(totalCredits),
    reversalDate: firstOfNextMonth(input.periodEnd).toISOString().slice(0, 10),
    supportingCalc: input.calc.reasoning,
    clauseRefs: input.clauseRefs ?? [],
  };
}
