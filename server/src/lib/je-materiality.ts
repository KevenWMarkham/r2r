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
  if (amt < 100_000)    return { approver: "auto-post",       tier: "standard" };
  if (amt < 1_000_000)  return { approver: "Senior Accountant", tier: "manager" };
  if (amt < 5_000_000)  return { approver: "Manager",           tier: "controller" };
  return { approver: "Manager + Director (dual)", tier: "exec" };
}
