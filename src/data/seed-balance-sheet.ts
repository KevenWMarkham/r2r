// Seed Balance Sheet for the Narrative Agent.
// Nike-shaped quarterly balance sheet — synthetic, do not use for anything real.
// Current period = period end being closed; Prior period = prior year end.

export type BalanceSheetCategory =
  | "Current Asset"
  | "Non-Current Asset"
  | "Current Liability"
  | "Non-Current Liability"
  | "Equity";

export interface BalanceSheetLine {
  id: string;
  lineItem: string;
  category: BalanceSheetCategory;
  currentPeriod: number; // period end balance
  priorPeriod: number;   // prior year end balance
  variance: number;
  variancePct: number;
  driver: string;
  /** Marks the line whose narrative is driven live by reviewed-contract JEs. */
  contractDriven?: boolean;
}

function row(
  id: string,
  lineItem: string,
  category: BalanceSheetCategory,
  current: number,
  prior: number,
  driver: string,
  contractDriven?: boolean
): BalanceSheetLine {
  const variance = current - prior;
  const variancePct = prior !== 0 ? (variance / prior) * 100 : 0;
  return {
    id,
    lineItem,
    category,
    currentPeriod: current,
    priorPeriod: prior,
    variance,
    variancePct: Math.round(variancePct * 10) / 10,
    driver,
    contractDriven,
  };
}

export const seedBalanceSheet: BalanceSheetLine[] = [
  // ── Current Assets ─────────────────────────────────────────────────────────
  row("ca-cash", "Cash & Equivalents", "Current Asset",
    10_500_000_000, 10_700_000_000,
    "Operating cash strong; offset by share repurchases and dividends"),
  row("ca-ar", "Accounts Receivable", "Current Asset",
    5_120_000_000, 4_920_000_000,
    "DTC revenue growth; days-sales-outstanding flat at 38 days"),
  row("ca-inventory", "Inventories", "Current Asset",
    7_530_000_000, 8_230_000_000,
    "Successful destocking program; channel inventory normalized"),
  row("ca-prepaid", "Prepaid Expenses & Other", "Current Asset",
    1_410_000_000, 1_310_000_000,
    "Annual insurance premium prepayment; higher cloud-services prepaid"),

  // ── Non-Current Assets ─────────────────────────────────────────────────────
  row("nca-ppe", "Property, Plant & Equipment (net)", "Non-Current Asset",
    5_140_000_000, 4_940_000_000,
    "DC automation capex; new innovation center; net of D&A"),
  row("nca-rou", "Operating Lease ROU Assets", "Non-Current Asset",
    3_220_000_000, 3_020_000_000,
    "Renewals at higher rates; new flagship leases in EMEA + GC"),
  row("nca-other", "Goodwill, Intangibles & Other LT Assets", "Non-Current Asset",
    1_950_000_000, 1_810_000_000,
    "Deferred tax asset growth; minor brand acquisition Q1"),

  // ── Current Liabilities ────────────────────────────────────────────────────
  row("cl-ap", "Accounts Payable", "Current Liability",
    2_490_000_000, 2_690_000_000,
    "Supplier payment-terms standardization; strategic AP financing"),
  row("cl-accrued", "Accrued Liabilities", "Current Liability",
    5_950_000_000, 5_800_000_000,
    "See Reviewed Contracts driver — accrual JEs from /contracts queue feed this line.",
    true),
  row("cl-itax", "Income Taxes Payable", "Current Liability",
    520_000_000, 415_000_000,
    "Higher pre-tax income; APLA discrete items"),

  // ── Non-Current Liabilities ────────────────────────────────────────────────
  row("ncl-debt", "Long-Term Debt", "Non-Current Liability",
    8_920_000_000, 8_900_000_000,
    "No new issuances; minor mark-to-market on hedged tranches"),
  row("ncl-lease", "Operating Lease Liabilities (LT)", "Non-Current Liability",
    2_710_000_000, 2_610_000_000,
    "Mirrors ROU asset growth; renewal pipeline in EMEA"),

  // ── Equity ─────────────────────────────────────────────────────────────────
  row("eq-total", "Total Shareholders' Equity", "Equity",
    23_220_000_000, 20_315_000_000,
    "Net income + OCI; partially offset by buybacks and dividends"),
];

export function topBSVariancesByDollar(n = 3): BalanceSheetLine[] {
  return [...seedBalanceSheet]
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, n);
}
