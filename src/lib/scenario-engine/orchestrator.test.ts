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

  it("pre-money SAFE (YC 2013) and post-money SAFE (YC 2018) use different denominators and yield different dilution", () => {
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

    // The two SAFE types use materially different denominators, so they produce
    // different share counts and different cap prices for the same paper terms.
    expect(preSafe.capPrice!.eq(postSafe.capPrice!)).toBe(false);
    expect(preSafe.sharesIssued).not.toBe(postSafe.sharesIssued);

    // YC 2018 invariant: the post-money SAFE holder receives amount/cap of the
    // post-conversion fully-diluted cap table (before new money is added).
    const postConvStage = post.stages.find((s) => s.stageName === "CONVERSIONS")!;
    const postConvFD = postConvStage.fullyDiluted;
    const safePctOfPostConv = new Decimal(postSafe.sharesIssued.toString())
      .div(postConvFD.toString())
      .mul(100);
    // 1M / 10M cap = 10% target, allow 0.1% tolerance for integer flooring.
    expect(safePctOfPostConv.minus(10).abs().lt(new Decimal("0.1"))).toBe(true);
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

  it("MFN SAFE with no explicit terms inherits best-for-investor terms from non-MFN siblings", () => {
    const input = makeSeedInput();
    input.baseline.safes = [
      {
        id: "safe-terms-a",
        stakeholderId: "vA",
        stakeholderName: "VC A",
        issueDate: "2025-01-01",
        purchaseAmount: "500000",
        valuationCap: "8000000", // lower cap = better for investor
        discountPercent: "10",
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "A",
      },
      {
        id: "safe-terms-b",
        stakeholderId: "vB",
        stakeholderName: "VC B",
        issueDate: "2025-02-01",
        purchaseAmount: "250000",
        valuationCap: "12000000",
        discountPercent: "25", // higher discount = better for investor
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "B",
      },
      {
        id: "safe-mfn",
        stakeholderId: "vM",
        stakeholderName: "VC MFN",
        issueDate: "2025-03-01",
        purchaseAmount: "100000",
        valuationCap: null,
        discountPercent: null,
        mfn: true,
        postMoney: true,
        status: "OUTSTANDING",
        label: "MFN",
      },
    ];
    const r = runScenario(input);
    const mfn = r.convertibleDetails.find((d) => d.instrumentId === "safe-mfn")!;
    // Inherited cap = min(8M, 12M) = 8M; inherited discount = max(10, 25) = 25.
    expect(mfn.selectedMethod).not.toBe("UNRESOLVED_MFN");
    expect(mfn.sharesIssued > 0n).toBe(true);
    expect(r.warnings.some((w) => w.code === "MFN_INFERRED")).toBe(true);
  });

  it("MFN SAFE with no siblings remains unresolved and emits MFN_UNRESOLVED warning", () => {
    const input = makeSeedInput();
    input.baseline.safes = [
      {
        id: "safe-mfn-alone",
        stakeholderId: "vM",
        stakeholderName: "VC MFN",
        issueDate: "2025-03-01",
        purchaseAmount: "100000",
        valuationCap: null,
        discountPercent: null,
        mfn: true,
        postMoney: true,
        status: "OUTSTANDING",
        label: "MFN Alone",
      },
    ];
    const r = runScenario(input);
    const mfn = r.convertibleDetails[0];
    expect(mfn.selectedMethod).toBe("UNRESOLVED_MFN");
    expect(mfn.sharesIssued).toBe(0n);
    expect(r.warnings.some((w) => w.code === "MFN_UNRESOLVED")).toBe(true);
  });

  it("YC 2018 post-money SAFE: holder receives amount/cap of post-conversion FD (self-referential denom)", () => {
    const input = makeSeedInput();
    input.baseline.holdings = [
      {
        id: "h1",
        stakeholderId: "s1",
        stakeholderName: "Founder",
        securityClassId: "sc1",
        securityClassName: "Common",
        securityType: "COMMON",
        shareCount: 9_000_000n,
        status: "ACTIVE",
      },
    ];
    input.baseline.optionGrants = [];
    input.baseline.reservedUngrantedPool = "0";
    input.baseline.safes = [
      {
        id: "safe-post",
        stakeholderId: "vc1",
        stakeholderName: "VC A",
        issueDate: "2025-06-15",
        purchaseAmount: "1000000",
        valuationCap: "10000000",
        discountPercent: null,
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "Post-money",
      },
    ];
    input.round.preMoneyValuation = "9000000";
    input.round.newMoney = "2000000";
    input.round.optionPoolTopUpMode = "NONE";
    const r = runScenario(input);
    const safe = r.convertibleDetails[0];
    const postConvStage = r.stages.find((s) => s.stageName === "CONVERSIONS")!;
    // 1M investment / 10M cap = 10% of post-conversion FD (pre-Series A new money).
    const pct = new Decimal(safe.sharesIssued.toString())
      .div(postConvStage.fullyDiluted.toString())
      .mul(100);
    expect(pct.minus(10).abs().lt(new Decimal("0.01"))).toBe(true);
  });

  it("stacked post-money SAFEs iterate to a shared denominator (multiple self-referential SAFEs)", () => {
    const input = makeSeedInput();
    input.baseline.holdings = [
      {
        id: "h1",
        stakeholderId: "s1",
        stakeholderName: "Founder",
        securityClassId: "sc1",
        securityClassName: "Common",
        securityType: "COMMON",
        shareCount: 9_000_000n,
        status: "ACTIVE",
      },
    ];
    input.baseline.optionGrants = [];
    input.baseline.reservedUngrantedPool = "0";
    input.baseline.safes = [
      {
        id: "s1",
        stakeholderId: "vc1",
        stakeholderName: "A",
        issueDate: "2025-01-01",
        purchaseAmount: "500000",
        valuationCap: "8000000",
        discountPercent: null,
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "A",
      },
      {
        id: "s2",
        stakeholderId: "vc2",
        stakeholderName: "B",
        issueDate: "2025-02-01",
        purchaseAmount: "500000",
        valuationCap: "12000000",
        discountPercent: null,
        mfn: false,
        postMoney: true,
        status: "OUTSTANDING",
        label: "B",
      },
    ];
    input.round.preMoneyValuation = "9000000";
    input.round.newMoney = "1000000";
    input.round.optionPoolTopUpMode = "NONE";
    const r = runScenario(input);
    const postConvStage = r.stages.find((s) => s.stageName === "CONVERSIONS")!;
    // Each SAFE gets amount/cap of post-conversion FD.
    for (const [id, cap] of [
      ["s1", 8_000_000],
      ["s2", 12_000_000],
    ] as const) {
      const d = r.convertibleDetails.find((x) => x.instrumentId === id)!;
      const pct = new Decimal(d.sharesIssued.toString())
        .div(postConvStage.fullyDiluted.toString())
        .mul(100);
      const target = new Decimal(500_000).div(cap).mul(100);
      expect(pct.minus(target).abs().lt(new Decimal("0.02"))).toBe(true);
    }
  });

  it("30/360 day-count note accrues different interest than default ACT/365", () => {
    const makeInput = (convention: "ACT_365" | "30_360"): ScenarioInput => {
      const input = makeSeedInput();
      input.baseline.notes = [
        {
          id: "note1",
          stakeholderId: "vc1",
          stakeholderName: "Bridge Lender",
          issueDate: "2025-01-15",
          maturityDate: null,
          principal: "500000",
          annualInterestRatePercent: "8",
          interestType: "SIMPLE",
          compoundingFrequencyPerYear: null,
          valuationCap: "10000000",
          discountPercent: null,
          mfn: false,
          status: "OUTSTANDING",
          label: "Bridge",
          dayCountConvention: convention,
        },
      ];
      input.round.roundCloseDate = "2026-03-31";
      return input;
    };
    const defaultR = runScenario(makeInput("ACT_365"));
    const r30 = runScenario(makeInput("30_360"));
    const d1 = defaultR.convertibleDetails[0];
    const d2 = r30.convertibleDetails[0];
    expect(d1.accruedInterest.eq(d2.accruedInterest)).toBe(false);
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
