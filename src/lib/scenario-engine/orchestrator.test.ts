import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { runScenario } from "./orchestrator";
import type { ScenarioInput } from "./types";

function makeSeedInput(): ScenarioInput {
  return {
    companyName: "Acme Labs, Inc.",
    authorizedCommonShares: "20000000",
    authorizedPreferredShares: "10000000",
    baseline: {
      reservedUngrantedPool: "2000000",
      holdings: [
        {
          id: "h1",
          stakeholderId: "s1",
          stakeholderName: "Alex Founder",
          securityClassId: "sc1",
          securityClassName: "Common",
          securityType: "COMMON",
          shareCount: 8_000_000n,
          status: "ACTIVE",
        },
        {
          id: "h2",
          stakeholderId: "s2",
          stakeholderName: "Jamie Founder",
          securityClassId: "sc1",
          securityClassName: "Common",
          securityType: "COMMON",
          shareCount: 8_000_000n,
          status: "ACTIVE",
        },
      ],
      optionGrants: [
        {
          id: "og1",
          stakeholderId: "s3",
          stakeholderName: "Jordan Employee",
          optionCount: 100_000n,
          exercisedCount: 0n,
          cancelledCount: 0n,
          status: "ACTIVE",
          strikePrice: "0.10",
          grantDate: "2025-04-01",
        },
      ],
      safes: [],
      notes: [],
    },
    round: {
      roundType: "PRICED_ROUND",
      preMoneyValuation: "8000000",
      newMoney: "2000000",
      roundCloseDate: "2026-06-01",
      optionPoolTopUpMode: "NONE",
      capDenominatorMethod: "CURRENT_FULLY_DILUTED",
      preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED",
      conversionOrderingRule: "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
      notesConvertUsing: "BEST_FOR_INVESTOR",
      safesConvertUsing: "BEST_FOR_INVESTOR",
    },
    newInstruments: [],
  };
}

describe("runScenario — end-to-end", () => {
  it("ownership sums to ~100% for priced round without convertibles", () => {
    const r = runScenario(makeSeedInput());
    const total = r.finalOwnership.reduce(
      (acc, row) => acc.add(row.percentOfFD),
      new Decimal(0),
    );
    expect(total.minus(100).abs().lte(new Decimal("0.0001"))).toBe(true);
    expect(r.intermediates.pricePerShare).not.toBeNull();
    expect(r.stages.length).toBeGreaterThanOrEqual(3);
  });

  it("priced round with stacked SAFE converts to lower of cap/discount", () => {
    const input = makeSeedInput();
    input.baseline.safes = [
      {
        id: "safe1",
        stakeholderId: "vc1",
        stakeholderName: "VC A",
        issueDate: "2025-06-15",
        purchaseAmount: "500000",
        valuationCap: "5000000",
        discountPercent: null,
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "SAFE A",
      },
    ];
    const r = runScenario(input);
    const detail = r.convertibleDetails[0];
    expect(detail.selectedMethod).toBe("CAP");
    expect(detail.sharesIssued > 0n).toBe(true);
    const total = r.finalOwnership.reduce(
      (acc, row) => acc.add(row.percentOfFD),
      new Decimal(0),
    );
    expect(total.minus(100).abs().lte(new Decimal("0.01"))).toBe(true);
  });

  it("MFN SAFE without terms is flagged as warning and not converted", () => {
    const input = makeSeedInput();
    input.baseline.safes = [
      {
        id: "safe-mfn",
        stakeholderId: "vc1",
        stakeholderName: "VC MFN",
        issueDate: "2025-06-15",
        purchaseAmount: "100000",
        valuationCap: null,
        discountPercent: null,
        mfn: true,
        postMoney: true,
        status: "OUTSTANDING",
        label: "MFN SAFE",
      },
    ];
    const r = runScenario(input);
    expect(r.warnings.some((w) => w.code === "MFN_UNRESOLVED")).toBe(true);
    expect(r.convertibleDetails[0].sharesIssued).toBe(0n);
  });

  it("authorized-shares exceeded surfaces a critical warning", () => {
    const input = makeSeedInput();
    input.authorizedCommonShares = "1000"; // far too low
    input.authorizedPreferredShares = "0";
    const r = runScenario(input);
    expect(r.warnings.some((w) => w.code === "AUTHORIZED_EXCEEDED")).toBe(true);
  });

  it("determinism: same input yields same output", () => {
    const a = runScenario(makeSeedInput());
    const b = runScenario(makeSeedInput());
    expect(a.intermediates.pricePerShare?.toFixed(8)).toBe(b.intermediates.pricePerShare?.toFixed(8));
    expect(a.finalOwnership.length).toBe(b.finalOwnership.length);
  });
});
