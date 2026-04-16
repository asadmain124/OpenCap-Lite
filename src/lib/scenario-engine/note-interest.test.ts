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
});
