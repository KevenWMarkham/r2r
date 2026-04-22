// Seed P&L for the Narrative Agent (UC-18, UC-20).
// Realistic Nike-shaped FY quarterly figures — synthetic, do not use for anything real.

export type Entity = "NA" | "EMEA" | "GC" | "APLA";
export type PnLCategory = "Revenue" | "COGS" | "Opex" | "Below-Line";

export interface PnLLine {
  id: string;
  lineItem: string;
  category: PnLCategory;
  currentPeriod: number;   // dollars
  priorPeriod: number;     // dollars
  variance: number;        // currentPeriod - priorPeriod
  variancePct: number;     // (variance / priorPeriod) * 100
  driver: string;          // compact natural-language driver summary
  entitySplit: Record<Entity, number>; // current-period breakdown
}

function row(
  id: string,
  lineItem: string,
  category: PnLCategory,
  current: number,
  prior: number,
  driver: string,
  split: Record<Entity, number>
): PnLLine {
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
    entitySplit: split,
  };
}

export const seedPnL: PnLLine[] = [
  // ── Revenue ──────────────────────────────────────────────────────────────
  row("rev-dtc", "Direct-to-Consumer Revenue", "Revenue",
    2_845_000_000, 2_710_000_000,
    "Volume +3%; Price +2%; Mix +0.5%; FX headwind -0.5%",
    { NA: 1_280_000_000, EMEA: 720_000_000, GC: 515_000_000, APLA: 330_000_000 }),
  row("rev-wholesale", "Wholesale Revenue", "Revenue",
    4_120_000_000, 4_295_000_000,
    "Volume -2%; key account destocking in NA; EMEA resilient",
    { NA: 1_740_000_000, EMEA: 1_190_000_000, GC: 750_000_000, APLA: 440_000_000 }),
  row("rev-licensing", "Licensing & Royalty", "Revenue",
    142_000_000, 128_000_000,
    "New licensee expansion in Greater China; royalty rate mix favorable",
    { NA: 42_000_000, EMEA: 35_000_000, GC: 48_000_000, APLA: 17_000_000 }),

  // ── COGS ─────────────────────────────────────────────────────────────────
  row("cogs-product", "Product Cost of Sales", "COGS",
    3_840_000_000, 3_715_000_000,
    "Material deflation -1.5%; offset by higher freight rates and mix shift to premium",
    { NA: 1_580_000_000, EMEA: 1_090_000_000, GC: 720_000_000, APLA: 450_000_000 }),
  row("cogs-logistics", "Logistics & Distribution", "COGS",
    385_000_000, 420_000_000,
    "Reduced ocean freight rates; improved DC throughput in EMEA",
    { NA: 155_000_000, EMEA: 98_000_000, GC: 88_000_000, APLA: 44_000_000 }),

  // ── Opex ─────────────────────────────────────────────────────────────────
  row("opex-demand-creation", "Demand Creation (Marketing)", "Opex",
    1_180_000_000, 1_050_000_000,
    "Campaign investment for Q2 product launch; digital spend +18% YoY",
    { NA: 485_000_000, EMEA: 340_000_000, GC: 220_000_000, APLA: 135_000_000 }),
  row("opex-sga", "Selling, General & Administrative", "Opex",
    1_745_000_000, 1_692_000_000,
    "Corporate headcount investment +4%; FX-neutral wage inflation ~3%",
    { NA: 820_000_000, EMEA: 460_000_000, GC: 285_000_000, APLA: 180_000_000 }),
  row("opex-rd", "Research, Design & Development", "Opex",
    178_000_000, 162_000_000,
    "Innovation center expansion; new materials science initiative",
    { NA: 102_000_000, EMEA: 38_000_000, GC: 24_000_000, APLA: 14_000_000 }),
  row("opex-store-ops", "Store Operations", "Opex",
    412_000_000, 395_000_000,
    "Lease expense +4% from renewals; labor +3% at minimum-wage locations",
    { NA: 168_000_000, EMEA: 112_000_000, GC: 95_000_000, APLA: 37_000_000 }),
  row("opex-da", "Depreciation & Amortization", "Opex",
    214_000_000, 198_000_000,
    "Tech modernization capex coming online; DC automation rollouts",
    { NA: 92_000_000, EMEA: 58_000_000, GC: 42_000_000, APLA: 22_000_000 }),

  // ── Below-line ───────────────────────────────────────────────────────────
  row("below-interest", "Net Interest Expense", "Below-Line",
    48_000_000, 35_000_000,
    "Higher short-term borrowings; rate environment elevated",
    { NA: 48_000_000, EMEA: 0, GC: 0, APLA: 0 }),
  row("below-other", "Other Income/(Expense)", "Below-Line",
    -22_000_000, 18_000_000,
    "FX translation losses on APLA exposure; prior-period gain on asset sale",
    { NA: -12_000_000, EMEA: -6_000_000, GC: -4_000_000, APLA: 0 }),
  row("below-tax", "Income Tax Expense", "Below-Line",
    228_000_000, 242_000_000,
    "Effective rate 20.8% vs 21.6% prior; discrete benefits in EMEA",
    { NA: 122_000_000, EMEA: 51_000_000, GC: 40_000_000, APLA: 15_000_000 }),
];

export const PNL_BY_CATEGORY: Record<PnLCategory, PnLLine[]> = seedPnL.reduce(
  (acc, l) => {
    (acc[l.category] ||= []).push(l);
    return acc;
  },
  {} as Record<PnLCategory, PnLLine[]>
);

/** Top variances by absolute dollar impact (for exec summary + dashboard). */
export function topVariancesByDollar(n = 3): PnLLine[] {
  return [...seedPnL]
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, n);
}

/** Simple aggregate — closeCockpit uses this for the exec narrative trigger. */
export function pnlAggregates() {
  const revenue = seedPnL
    .filter((l) => l.category === "Revenue")
    .reduce((s, l) => s + l.currentPeriod, 0);
  const cogs = seedPnL
    .filter((l) => l.category === "COGS")
    .reduce((s, l) => s + l.currentPeriod, 0);
  const opex = seedPnL
    .filter((l) => l.category === "Opex")
    .reduce((s, l) => s + l.currentPeriod, 0);
  const priorRevenue = seedPnL
    .filter((l) => l.category === "Revenue")
    .reduce((s, l) => s + l.priorPeriod, 0);
  return {
    revenue,
    cogs,
    grossMargin: revenue - cogs,
    grossMarginPct: ((revenue - cogs) / revenue) * 100,
    opex,
    revenueYoYPct: ((revenue - priorRevenue) / priorRevenue) * 100,
  };
}
