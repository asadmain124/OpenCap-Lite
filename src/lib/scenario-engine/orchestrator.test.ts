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

  it("pre-money SAFE (YC 2013) dilutes differently than post-money SAFE (YC 2018) when pool top-up occurs", () => {
    const makeInput = (postMoney: boolean): ScenarioInput => {
      const input = makeSeedInput();
      input.baseline.safes = [
        {
          id: "safe1",
          stakeholderId: "vc1",
          stakeholderName: "VC A",
          issueDate: "2025-06-15",
          purchaseAmount: "1000000",
          valuationCap: "10000000",
          discountPercent: null,
          mfn: false,
          postMoney,
          status: "OUTSTANDING",
          label: "SAFE A",
        },
      ];
      input.round.optionPoolTopUpMode = "TO_TARGET_POST_MONEY_PERCENT";
      input.round.optionPoolTargetPercent = "0.10";
      return input;
    };

    const post = runScenario(makeInput(true));
    const pre = runScenario(makeInput(false));

    const postSafe = post.convertibleDetails.find((d) => d.instrumentId === "safe1")!;
    const preSafe = pre.convertibleDetails.find((d) => d.instrumentId === "safe1")!;

    // Pre-money SAFE (YC 2013) denominator includes the new option pool top-up
    // (see YC 2013 §"Company Capitalization"), so its cap price is lower and the
    // SAFE holder receives more shares — i.e., the pool dilution is absorbed by
    // founders, not the SAFE holder. Post-money SAFE (YC 2018) denominator
    // excludes the new top-up, so the SAFE holder IS diluted by the new pool.
    expect(preSafe.capPrice!.lt(postSafe.capPrice!)).toBe(true);
    expect(preSafe.sharesIssued > postSafe.sharesIssued).toBe(true);
  });

  it("SAFE with both cap and discount selects lower of the two under BEST_FOR_INVESTOR", () => {
    const input = makeSeedInput();
    input.baseline.safes = [
      {
        id: "safe1",
        stakeholderId: "vc1",
        stakeholderName: "VC A",
        issueDate: "2025-06-15",
        purchaseAmount: "500000",
        valuationCap: "5000000",
        discountPercent: "20",
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "SAFE A",
      },
    ];
    const r = runScenario(input);
    const detail = r.convertibleDetails[0];
    expect(detail.capPrice).not.toBeNull();
    expect(detail.discountPrice).not.toBeNull();
    // BEST_FOR_INVESTOR picks the lower price.
    expect(detail.selectedPrice!.lte(detail.capPrice!)).toBe(true);
    expect(detail.selectedPrice!.lte(detail.discountPrice!)).toBe(true);
  });

  it("USER_SELECTED_PER_SAFE honors per-instrument cap/discount choice", () => {
    const input = makeSeedInput();
    input.round.safesConvertUsing = "USER_SELECTED_PER_SAFE";
    input.baseline.safes = [
      {
        id: "safe-cap",
        stakeholderId: "vc1",
        stakeholderName: "VC A",
        issueDate: "2025-06-15",
        purchaseAmount: "500000",
        valuationCap: "20000000", // cap price > discount price
        discountPercent: "50",
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "SAFE Cap-picker",
        userSelectedMethod: "CAP",
      },
      {
        id: "safe-discount",
        stakeholderId: "vc2",
        stakeholderName: "VC B",
        issueDate: "2025-06-15",
        purchaseAmount: "500000",
        valuationCap: "5000000", // cap price < discount price
        discountPercent: "10",
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "SAFE Discount-picker",
        userSelectedMethod: "DISCOUNT",
      },
    ];
    const r = runScenario(input);
    const cap = r.convertibleDetails.find((d) => d.instrumentId === "safe-cap")!;
    const disc = r.convertibleDetails.find((d) => d.instrumentId === "safe-discount")!;
    expect(cap.selectedMethod).toBe("CAP");
    expect(disc.selectedMethod).toBe("DISCOUNT");
  });
});
