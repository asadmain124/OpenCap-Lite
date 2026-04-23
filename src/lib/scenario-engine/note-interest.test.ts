import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { computeAccruedInterest } from "./note-interest";

describe("computeAccruedInterest", () => {
  it("simple interest: 100000 @ 8% for 365 days = 8000", () => {
    const r = computeAccruedInterest({
      principal: "100000",
      annualInterestRatePercent: "8",
      interestType: "SIMPLE",
      compoundingFrequencyPerYear: null,
      issueDate: new Date("2025-01-01"),
      accrualCutoffDate: new Date("2026-01-01"),
    });
    expect(r.daysElapsed).toBe(365);
    expect(r.accruedInterest.toFixed(2)).toBe("8000.00");
    expect(r.totalConversionAmount.toFixed(2)).toBe("108000.00");
  });

  it("simple interest: half year", () => {
    const r = computeAccruedInterest({
      principal: "250000",
      annualInterestRatePercent: "6",
      interestType: "SIMPLE",
      compoundingFrequencyPerYear: null,
      issueDate: new Date("2025-01-01"),
      // 181 days to 2025-07-01
      accrualCutoffDate: new Date("2025-07-01"),
    });
    expect(r.daysElapsed).toBe(181);
    const expected = new Decimal(250000).mul(0.06).mul(181).div(365);
    expect(r.accruedInterest.minus(expected).abs().lt(0.01)).toBe(true);
  });

  it("compound quarterly: 100000 @ 8% for 365 days", () => {
    const r = computeAccruedInterest({
      principal: "100000",
      annualInterestRatePercent: "8",
      interestType: "COMPOUND",
      compoundingFrequencyPerYear: 4,
      issueDate: new Date("2025-01-01"),
      accrualCutoffDate: new Date("2026-01-01"),
    });
    // (1.02)^4 - 1 = 0.08243216
    const expected = new Decimal(100000).mul(Decimal.pow(1.02, 4).minus(1));
    expect(r.accruedInterest.minus(expected).abs().lt(0.01)).toBe(true);
  });

  it("compound monthly: 12 periods in a year", () => {
    const r = computeAccruedInterest({
      principal: "100000",
      annualInterestRatePercent: "12",
      interestType: "COMPOUND",
      compoundingFrequencyPerYear: 12,
      issueDate: new Date("2025-01-01"),
      accrualCutoffDate: new Date("2026-01-01"),
    });
    const expected = new Decimal(100000).mul(Decimal.pow(new Decimal(1).add(new Decimal(0.12).div(12)), 12).minus(1));
    expect(r.accruedInterest.minus(expected).abs().lt(0.1)).toBe(true);
  });

  it("throws when compound but no frequency", () => {
    expect(() =>
      computeAccruedInterest({
        principal: "100000",
        annualInterestRatePercent: "6",
        interestType: "COMPOUND",
        compoundingFrequencyPerYear: null,
        issueDate: new Date("2025-01-01"),
        accrualCutoffDate: new Date("2026-01-01"),
      }),
    ).toThrow(/compoundingFrequencyPerYear/);
  });

  it("ACT/360 convention: 100000 @ 8% for 360 actual days = 8000 exactly", () => {
    const r = computeAccruedInterest({
      principal: "100000",
      annualInterestRatePercent: "8",
      interestType: "SIMPLE",
      compoundingFrequencyPerYear: null,
      issueDate: new Date("2025-01-01"),
      accrualCutoffDate: new Date("2025-12-27"), // exactly 360 actual days
      dayCountConvention: "ACT_360",
    });
    expect(r.daysElapsed).toBe(360);
    expect(r.accruedInterest.toFixed(2)).toBe("8000.00");
  });

  it("ACT/360 accrues more than ACT/365 for the same period", () => {
    const args = {
      principal: "100000",
      annualInterestRatePercent: "10",
      interestType: "SIMPLE" as const,
      compoundingFrequencyPerYear: null,
      issueDate: new Date("2025-01-01"),
      accrualCutoffDate: new Date("2025-07-01"),
    };
    const act365 = computeAccruedInterest({ ...args, dayCountConvention: "ACT_365" });
    const act360 = computeAccruedInterest({ ...args, dayCountConvention: "ACT_360" });
    expect(act360.accruedInterest.gt(act365.accruedInterest)).toBe(true);
  });

  it("30/360 convention: one calendar year = 360 days", () => {
    const r = computeAccruedInterest({
      principal: "100000",
      annualInterestRatePercent: "8",
      interestType: "SIMPLE",
      compoundingFrequencyPerYear: null,
      issueDate: new Date(Date.UTC(2025, 0, 15)),
      accrualCutoffDate: new Date(Date.UTC(2026, 0, 15)),
      dayCountConvention: "30_360",
    });
    // 30/360: 360*(2026-2025) + 30*(1-1) + (15-15) = 360
    expect(r.daysElapsed).toBe(360);
    expect(r.accruedInterest.toFixed(2)).toBe("8000.00");
  });

  it("30/360 convention: day > 30 is clamped (European 30E/360)", () => {
    const r = computeAccruedInterest({
      principal: "100000",
      annualInterestRatePercent: "12",
      interestType: "SIMPLE",
      compoundingFrequencyPerYear: null,
      issueDate: new Date(Date.UTC(2025, 0, 31)),
      accrualCutoffDate: new Date(Date.UTC(2025, 2, 31)),
      dayCountConvention: "30_360",
    });
    // 30/360: 360*(0) + 30*(3-1) + (min(30,31) - min(30,31)) = 60 days
    expect(r.daysElapsed).toBe(60);
  });

  it("default (no convention specified) uses ACT/365", () => {
    const r = computeAccruedInterest({
      principal: "100000",
      annualInterestRatePercent: "8",
      interestType: "SIMPLE",
      compoundingFrequencyPerYear: null,
      issueDate: new Date("2025-01-01"),
      accrualCutoffDate: new Date("2026-01-01"),
    });
    expect(r.method).toContain("ACT_365");
    expect(r.accruedInterest.toFixed(2)).toBe("8000.00");
  });
});
