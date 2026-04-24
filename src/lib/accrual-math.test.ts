import { describe, it, expect } from "vitest";
import { calculateAccrual, parseCurrency, parseDate } from "./accrual-math";

describe("parseCurrency", () => {
  it("parses common money formats", () => {
    expect(parseCurrency("$120,000")).toBe(120000);
    expect(parseCurrency("$120,000.00")).toBe(120000);
    expect(parseCurrency("USD 1,500")).toBe(1500);
    expect(parseCurrency("$4.2M")).toBe(4_200_000);
    expect(parseCurrency("$1.5B")).toBe(1_500_000_000);
    expect(parseCurrency("250K")).toBe(250_000);
  });
  it("returns null on garbage", () => {
    expect(parseCurrency("nope")).toBe(null);
    expect(parseCurrency("")).toBe(null);
  });
});

describe("parseDate", () => {
  it("parses ISO dates", () => {
    expect(parseDate("2026-03-01")?.getFullYear()).toBe(2026);
  });
  it("returns null on garbage", () => {
    expect(parseDate("not a date")).toBe(null);
  });
});

describe("calculateAccrual — calendar-month proration (inclusive)", () => {
  it("1 full calendar month: Apr 1 → Apr 30 = 1.0 month", () => {
    const r = calculateAccrual({
      totalFee: 12_000,
      serviceStart: new Date(2026, 3, 1),   // April 1
      serviceEnd: new Date(2026, 3, 30),    // April 30
      periodEnd: new Date(2026, 3, 30),
      method: "straight-line",
      billedToDate: 0,
    });
    expect(r.monthsElapsed).toBe(1);
    expect(r.accruedCumulative).toBe(12_000);
    expect(r.periodAccrual).toBe(12_000);
  });

  it("2 full calendar months: Mar 1 → Apr 30 = 2.0 months", () => {
    const r = calculateAccrual({
      totalFee: 400_000 * 2,                 // 2 months × $400K
      serviceStart: new Date(2026, 2, 1),   // March 1
      serviceEnd: new Date(2026, 3, 30),    // April 30
      periodEnd: new Date(2026, 3, 30),
      method: "straight-line",
      billedToDate: 0,
    });
    expect(r.monthsElapsed).toBe(2);
  });

  it("4 full months of a 12-month contract: Jan 1 → Apr 30", () => {
    // Test from original TDD spec: $120,000 annual → $10K/month × 4 mo = $40K
    const r = calculateAccrual({
      totalFee: 120_000,
      serviceStart: new Date(2026, 0, 1),   // Jan 1
      serviceEnd: new Date(2026, 11, 31),   // Dec 31
      periodEnd: new Date(2026, 3, 30),     // April 30
      method: "straight-line",
      billedToDate: 0,
    });
    expect(r.monthsElapsed).toBe(4);
    expect(r.accruedCumulative).toBe(40_000);
    expect(r.periodAccrual).toBe(40_000);
  });

  it("GR/IR netting: earned 40K less billed 30K = period accrual 10K", () => {
    const r = calculateAccrual({
      totalFee: 120_000,
      serviceStart: new Date(2026, 0, 1),
      serviceEnd: new Date(2026, 11, 31),
      periodEnd: new Date(2026, 3, 30),
      method: "straight-line",
      billedToDate: 30_000,
    });
    expect(r.accruedCumulative).toBe(40_000);
    expect(r.periodAccrual).toBe(10_000);
  });

  it("zero-period: service starts after period end", () => {
    const r = calculateAccrual({
      totalFee: 120_000,
      serviceStart: new Date(2026, 5, 1),   // June 1
      serviceEnd: new Date(2026, 11, 31),
      periodEnd: new Date(2026, 3, 30),     // April 30 (before service started)
      method: "straight-line",
      billedToDate: 0,
    });
    expect(r.periodAccrual).toBe(0);
    expect(r.accruedCumulative).toBe(0);
  });

  it("mid-month start: Apr 15 → Apr 30 = ~15/30 = 0.5 month", () => {
    const r = calculateAccrual({
      totalFee: 12_000,
      serviceStart: new Date(2026, 3, 15),  // April 15
      serviceEnd: new Date(2026, 3, 30),
      periodEnd: new Date(2026, 3, 30),
      method: "straight-line",
      billedToDate: 0,
    });
    // Apr 15 to Apr 30 inclusive = 16 days out of 30 = 0.5333
    expect(r.monthsElapsed).toBeCloseTo(16 / 30, 2);
  });

  it("immediate method: full fee on day one", () => {
    const r = calculateAccrual({
      totalFee: 100_000,
      serviceStart: new Date(2026, 3, 1),
      serviceEnd: new Date(2027, 2, 31),
      periodEnd: new Date(2026, 3, 30),
      method: "immediate",
      billedToDate: 0,
    });
    expect(r.accruedCumulative).toBe(100_000);
    expect(r.periodAccrual).toBe(100_000);
  });
});
