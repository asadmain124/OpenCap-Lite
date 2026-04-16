import { describe, expect, it } from "vitest";
import { solveFixedEquityShares } from "./fixed-equity-solver";

describe("solveFixedEquityShares", () => {
  it("7% of 10M shares yields 752688 shares (hand-verified)", () => {
    const r = solveFixedEquityShares({
      targetPercent: "0.07",
      existingShares: 10_000_000n,
    });
    // (0.07 × 10_000_000) / (1 − 0.07) = 700000 / 0.93 = 752688.17 → 752689
    expect(r.sharesToIssue).toBe(752_689n);
    expect(r.resultingPercent.toFixed(4)).toBe("0.0700");
    expect(r.formula).toContain("(0.07 × 10000000)");
  });

  it("10% of 10M shares", () => {
    const r = solveFixedEquityShares({
      targetPercent: "0.10",
      existingShares: 10_000_000n,
    });
    // 1_000_000 / 0.9 = 1_111_111.11
    expect(r.sharesToIssue).toBe(1_111_112n);
  });

  it("throws at 100%", () => {
    expect(() =>
      solveFixedEquityShares({
        targetPercent: "1.0",
        existingShares: 10_000_000n,
      }),
    ).toThrow(/< 1/);
  });

  it("throws at 0%", () => {
    expect(() =>
      solveFixedEquityShares({
        targetPercent: "0",
        existingShares: 10_000_000n,
      }),
    ).toThrow(/> 0/);
  });
});
