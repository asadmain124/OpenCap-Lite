import { describe, expect, it } from "vitest";
import { computePoolTopUp } from "./pool-topup";

describe("computePoolTopUp", () => {
  it("NONE mode returns zero additional shares", () => {
    const r = computePoolTopUp({
      mode: "NONE",
      preMoneyFullyDiluted: 10_000_000n,
      currentPoolShares: 1_000_000n,
      interimFullyDiluted: 12_000_000n,
      newMoneyShares: 2_500_000n,
    });
    expect(r.additionalShares).toBe(0n);
    expect(r.converged).toBe(true);
  });

  it("FIXED_SHARES adds exactly that many", () => {
    const r = computePoolTopUp({
      mode: "FIXED_SHARES",
      preMoneyFullyDiluted: 10_000_000n,
      currentPoolShares: 1_000_000n,
      interimFullyDiluted: 12_000_000n,
      newMoneyShares: 2_500_000n,
      fixedShares: 500_000n,
    });
    expect(r.additionalShares).toBe(500_000n);
  });

  it("FIXED_PERCENT_PRE_MONEY adds preMoneyFD × percent", () => {
    const r = computePoolTopUp({
      mode: "FIXED_PERCENT_PRE_MONEY",
      preMoneyFullyDiluted: 10_000_000n,
      currentPoolShares: 0n,
      interimFullyDiluted: 10_000_000n,
      newMoneyShares: 0n,
      fixedPercentPreMoney: "0.05",
    });
    expect(r.additionalShares).toBe(500_000n);
  });

  it("TO_TARGET_POST_MONEY_PERCENT converges to the target", () => {
    const r = computePoolTopUp({
      mode: "TO_TARGET_POST_MONEY_PERCENT",
      preMoneyFullyDiluted: 10_000_000n,
      currentPoolShares: 500_000n,
      interimFullyDiluted: 12_000_000n,
      newMoneyShares: 2_500_000n,
      targetPercent: "0.10",
    });
    expect(r.converged).toBe(true);
    // Pool % of (12M + add + 2.5M) must be ~10%
    const diff = r.finalPoolPercent.minus("0.10").abs();
    expect(diff.toNumber()).toBeLessThan(0.0001);
    expect(r.additionalShares).toBeGreaterThan(0n);
  });

  it("TO_TARGET_POST_MONEY_PERCENT refuses to converge on out-of-range target", () => {
    const r = computePoolTopUp({
      mode: "TO_TARGET_POST_MONEY_PERCENT",
      preMoneyFullyDiluted: 10_000_000n,
      currentPoolShares: 0n,
      interimFullyDiluted: 10_000_000n,
      newMoneyShares: 0n,
      targetPercent: "1.5",
    });
    expect(r.converged).toBe(false);
  });
});
