import { describe, expect, it } from "vitest";
import { computeConversionPrice } from "./conversion-pricing";

describe("computeConversionPrice", () => {
  const base = {
    capDenominatorShares: 10_000_000n,
    roundPricePerShare: "1.00",
  };

  it("cap-only SAFE uses cap price", () => {
    const r = computeConversionPrice({
      ...base,
      valuationCap: "5000000",
      discountPercent: null,
      mfn: false,
      mode: "BEST_FOR_INVESTOR",
    });
    expect(r.selectedMethod).toBe("CAP");
    expect(r.effectivePrice!.toFixed(4)).toBe("0.5000");
  });

  it("discount-only SAFE uses discount price", () => {
    const r = computeConversionPrice({
      ...base,
      valuationCap: null,
      discountPercent: "20",
      mfn: false,
      mode: "BEST_FOR_INVESTOR",
    });
    expect(r.selectedMethod).toBe("DISCOUNT");
    expect(r.effectivePrice!.toFixed(4)).toBe("0.8000");
  });

  it("cap+discount BEST_FOR_INVESTOR picks the lower price", () => {
    const r = computeConversionPrice({
      ...base,
      valuationCap: "5000000", // => 0.5
      discountPercent: "10", // => 0.9
      mfn: false,
      mode: "BEST_FOR_INVESTOR",
    });
    expect(r.selectedMethod).toBe("CAP");
    expect(r.effectivePrice!.toFixed(4)).toBe("0.5000");
  });

  it("MFN with no terms returns UNRESOLVED_MFN", () => {
    const r = computeConversionPrice({
      ...base,
      valuationCap: null,
      discountPercent: null,
      mfn: true,
      mode: "BEST_FOR_INVESTOR",
    });
    expect(r.selectedMethod).toBe("UNRESOLVED_MFN");
    expect(r.effectivePrice).toBeNull();
  });

  it("USER_SELECTED CAP picks cap even if discount is lower", () => {
    const r = computeConversionPrice({
      ...base,
      valuationCap: "20000000", // pricier than discount
      discountPercent: "50",
      mfn: false,
      mode: "USER_SELECTED",
      userSelectedMethod: "CAP",
    });
    expect(r.selectedMethod).toBe("CAP");
    expect(r.effectivePrice!.toFixed(4)).toBe("2.0000");
  });

  it("USER_SELECTED DISCOUNT picks discount even if cap is lower", () => {
    const r = computeConversionPrice({
      ...base,
      valuationCap: "5000000",
      discountPercent: "10",
      mfn: false,
      mode: "USER_SELECTED",
      userSelectedMethod: "DISCOUNT",
    });
    expect(r.selectedMethod).toBe("DISCOUNT");
    expect(r.effectivePrice!.toFixed(4)).toBe("0.9000");
  });

  it("throws when capDenominatorShares <= 0", () => {
    expect(() =>
      computeConversionPrice({
        valuationCap: "1000000",
        discountPercent: null,
        mfn: false,
        capDenominatorShares: 0n,
        roundPricePerShare: "1.00",
        mode: "BEST_FOR_INVESTOR",
      }),
    ).toThrow(/capDenominatorShares/);
  });
});
