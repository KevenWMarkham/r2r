// UC-04 + UC-15: materiality-based routing.
// Amount thresholds decide who can approve a submitted JE.
// Auto-approve is standard for under-threshold accruals (UC-06 ≥75% auto-cert).

export type MaterialityTier = "standard" | "manager" | "controller" | "exec";

export interface MaterialityRouting {
  approver: string;
  tier: MaterialityTier;
}

export function routeForApproval(totalAmount: number): MaterialityRouting {
  const amt = Math.abs(totalAmount);
  if (amt < 100_000)    return { approver: "auto-approve", tier: "standard" };
  if (amt < 1_000_000)  return { approver: "Rachel",       tier: "manager" };
  if (amt < 10_000_000) return { approver: "Sarah",        tier: "controller" };
  return { approver: "CFO", tier: "exec" };
}
