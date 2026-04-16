import { describe, expect, it } from "vitest";
import { computePricedRoundPricePerShare } from "./priced-round";

describe("computePricedRoundPricePerShare", () => {
  it("uses override when supplied", () => {
    const r = computePricedRoundPricePerShare({
      preMoneyValuation: "8000000",
      preMoneyDenominatorShares: 10_000_000n,
      pricedRoundPricePerShareOverride: "2.0000",
      methodLabel: "USER_OVERRIDE",
    });
    expect(r.method).toBe("user override");
    expect(r.pricePerShare!.toFixed(4)).toBe("2.0000");
  });

  it("divides pre-money by denominator when no override", () => {
    const r = computePricedRoundPricePerShare({
      preMoneyValuation: "8000000",
      preMoneyDenominatorShares: 10_000_000n,
      methodLabel: "CURRENT_FULLY_DILUTED",
    });
    expect(r.pricePerShare!.toFixed(4)).toBe("0.8000");
  });

  it("returns null pps when preMoney not provided", () => {
    const r = computePricedRoundPricePerShare({
      preMoneyValuation: null,
      preMoneyDenominatorShares: 10_000_000n,
      methodLabel: "CURRENT_FULLY_DILUTED",
    });
    expect(r.pricePerShare).toBeNull();
  });

  it("throws if denominator is zero", () => {
    expect(() =>
      computePricedRoundPricePerShare({
        preMoneyValuation: "8000000",
        preMoneyDenominatorShares: 0n,
        methodLabel: "CURRENT_FULLY_DILUTED",
      }),
    ).toThrow(/preMoneyDenominatorShares/);
  });
});
