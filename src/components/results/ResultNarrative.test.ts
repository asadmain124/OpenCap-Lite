import { describe, expect, it } from "vitest";
import { buildNarrative } from "./ResultNarrative";
import type { SerializedScenarioResult } from "./ScenarioResults";

function fixture(overrides: Partial<SerializedScenarioResult> = {}): SerializedScenarioResult {
  return {
    intermediates: {
      pricePerShare: "4",
      pricePerShareMethod: "preMoneyValuation / denominator",
      preMoneyDenominatorShares: "2000000",
      capDenominatorShares: "2000000",
      baselineFullyDiluted: "2000000",
      poolTopUpShares: "0",
      poolTopUpMethod: "NONE",
      newInvestorShares: "500000",
    },
    stages: [
      {
        stageName: "BASELINE",
        description: "Initial",
        fullyDiluted: "2000000",
        ownership: [
          {
            stakeholderId: "f1",
            stakeholderName: "Alex Founder",
            securityType: "Common Stock",
            shareCount: "1600000",
            fullyDilutedShares: "2000000",
            percentOfFD: "80",
            group: "common",
          },
          {
            stakeholderId: null,
            stakeholderName: "Reserved Pool",
            securityType: "Option Pool Reserved",
            shareCount: "400000",
            fullyDilutedShares: "2000000",
            percentOfFD: "20",
            group: "reserved_pool",
          },
        ],
      },
      {
        stageName: "NEW_MONEY",
        description: "After new money",
        fullyDiluted: "2500000",
        ownership: [],
      },
    ],
    finalOwnership: [
      {
        stakeholderId: "f1",
        stakeholderName: "Alex Founder",
        securityType: "Common Stock",
        shareCount: "1600000",
        fullyDilutedShares: "2500000",
        percentOfFD: "64",
        group: "common",
      },
      {
        stakeholderId: "lead",
        stakeholderName: "Acme VC",
        securityType: "New Equity",
        shareCount: "500000",
        fullyDilutedShares: "2500000",
        percentOfFD: "20",
        group: "new_money",
      },
      {
        stakeholderId: null,
        stakeholderName: "Reserved Pool",
        securityType: "Option Pool Reserved",
        shareCount: "400000",
        fullyDilutedShares: "2500000",
        percentOfFD: "16",
        group: "reserved_pool",
      },
    ],
    convertibleDetails: [],
    warnings: [],
    formulaTrace: [],
    ...overrides,
  };
}

describe("buildNarrative", () => {
  it("describes founder dilution and lead investor for a vanilla priced round", () => {
    const insights = buildNarrative(fixture());
    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights[0]).toContain("80.0%");
    expect(insights[0]).toContain("64.0%");
    expect(insights[0]).toContain("−16.0 pp");
    expect(insights.some((s) => s.includes("Acme VC"))).toBe(true);
    expect(insights.some((s) => s.includes("$2,000,000"))).toBe(true);
    expect(insights.at(-1)).toMatch(/Post-money valuation/);
  });

  it("includes pool top-up summary when present", () => {
    const insights = buildNarrative(
      fixture({
        intermediates: {
          ...fixture().intermediates,
          poolTopUpShares: "250000",
        },
      }),
    );
    expect(insights.some((s) => s.includes("option pool top-up"))).toBe(true);
  });

  it("summarizes SAFE conversions", () => {
    const insights = buildNarrative(
      fixture({
        convertibleDetails: [
          {
            instrumentType: "SAFE",
            instrumentId: "s1",
            stakeholderName: "SAFE VC A",
            label: "SAFE (cap)",
            principal: "500000",
            accruedInterest: "0",
            totalConversionAmount: "500000",
            capPrice: "5",
            discountPrice: null,
            selectedPrice: "5",
            selectedMethod: "CAP",
            sharesIssued: "100000",
            explanation: "",
          },
        ],
      }),
    );
    expect(insights.some((s) => s.includes("1 SAFE"))).toBe(true);
    expect(insights.some((s) => s.includes("the valuation cap"))).toBe(true);
  });

  it("returns empty array on empty result", () => {
    const insights = buildNarrative({
      intermediates: {
        pricePerShare: null,
        pricePerShareMethod: "",
        preMoneyDenominatorShares: "0",
        capDenominatorShares: "0",
        baselineFullyDiluted: "0",
        poolTopUpShares: "0",
        poolTopUpMethod: "NONE",
        newInvestorShares: "0",
      },
      stages: [],
      finalOwnership: [],
      convertibleDetails: [],
      warnings: [],
      formulaTrace: [],
    });
    expect(insights).toEqual([]);
  });
});
