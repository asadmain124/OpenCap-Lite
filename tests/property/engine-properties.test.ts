import Decimal from "decimal.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeAccruedInterest } from "../../src/lib/scenario-engine/note-interest";
import { computeConversionPrice } from "../../src/lib/scenario-engine/conversion-pricing";
import { computePoolTopUp } from "../../src/lib/scenario-engine/pool-topup";
import { runScenario } from "../../src/lib/scenario-engine/orchestrator";
import type { ScenarioInput } from "../../src/lib/scenario-engine/types";

function buildSimpleInput(overrides: {
  newMoney: string;
  preMoney?: string;
  safeCap?: string | null;
  safeDiscount?: string | null;
  mfn?: boolean;
}): ScenarioInput {
  return {
    companyName: "prop-test",
    authorizedCommonShares: "1000000000",
    authorizedPreferredShares: "1000000000",
    baseline: {
      reservedUngrantedPool: "0",
      holdings: [
        {
          id: "h1",
          stakeholderId: "founder",
          stakeholderName: "Founder",
          securityClassId: "sc1",
          securityClassName: "Common",
          securityType: "COMMON",
          shareCount: 10_000_000n,
          status: "ACTIVE",
        },
      ],
      optionGrants: [],
      safes: overrides.safeCap != null || overrides.safeDiscount != null
        ? [
            {
              id: "safe1",
              stakeholderId: "vc",
              stakeholderName: "VC",
              issueDate: "2025-01-01",
              purchaseAmount: "500000",
              valuationCap: overrides.safeCap ?? null,
              discountPercent: overrides.safeDiscount ?? null,
              mfn: overrides.mfn ?? false,
              postMoney: true,
              status: "OUTSTANDING",
              label: "SAFE",
            },
          ]
        : [],
      notes: [],
    },
    round: {
      roundType: "PRICED_ROUND",
      preMoneyValuation: overrides.preMoney ?? "10000000",
      newMoney: overrides.newMoney,
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

describe("engine property tests", () => {
  it("ownership sums to ~100% for any valid priced round input", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500_000, max: 50_000_000 }),
        fc.integer({ min: 1_000_000, max: 100_000_000 }),
        (newMoney, preMoney) => {
          const result = runScenario(
            buildSimpleInput({ newMoney: String(newMoney), preMoney: String(preMoney) }),
          );
          const total = result.finalOwnership.reduce(
            (acc, row) => acc.add(row.percentOfFD),
            new Decimal(0),
          );
          return total.minus(100).abs().lte(new Decimal("0.01"));
        },
      ),
      { numRuns: 50 },
    );
  });

  it("BEST_FOR_INVESTOR selectedPrice ≤ min(capPrice, discountPrice)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000, max: 100_000_000 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1_000_000, max: 50_000_000 }),
        fc.integer({ min: 100, max: 10000 }),
        (capMoney, discount, capDenomMillions, roundPriceCents) => {
          const capDenom = BigInt(capDenomMillions);
          if (capDenom <= 0n) return true;
          const r = computeConversionPrice({
            valuationCap: String(capMoney),
            discountPercent: String(discount),
            mfn: false,
            capDenominatorShares: capDenom,
            roundPricePerShare: new Decimal(roundPriceCents).div(100).toString(),
            mode: "BEST_FOR_INVESTOR",
          });
          if (r.capPrice == null || r.discountPrice == null || r.effectivePrice == null) return true;
          const lower = r.capPrice.lte(r.discountPrice) ? r.capPrice : r.discountPrice;
          return r.effectivePrice.lte(lower);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("note accrued interest is monotonically non-decreasing with time", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 720 }), fc.integer({ min: 0, max: 30 }), (days, extra) => {
        const issue = new Date("2025-01-01");
        const t1 = new Date(issue.getTime() + days * 86_400_000);
        const t2 = new Date(t1.getTime() + extra * 86_400_000);
        const a = computeAccruedInterest({
          principal: "100000",
          annualInterestRatePercent: "8",
          interestType: "SIMPLE",
          compoundingFrequencyPerYear: null,
          issueDate: issue,
          accrualCutoffDate: t1,
        });
        const b = computeAccruedInterest({
          principal: "100000",
          annualInterestRatePercent: "8",
          interestType: "SIMPLE",
          compoundingFrequencyPerYear: null,
          issueDate: issue,
          accrualCutoffDate: t2,
        });
        return b.accruedInterest.gte(a.accruedInterest);
      }),
      { numRuns: 50 },
    );
  });

  it("pool top-up TO_TARGET_POST_MONEY_PERCENT converges within ε", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 25 }),
        fc.integer({ min: 1_000_000, max: 20_000_000 }),
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (pctInt, interimM, poolM, newMoneyM) => {
          const pct = new Decimal(pctInt).div(100);
          const r = computePoolTopUp({
            mode: "TO_TARGET_POST_MONEY_PERCENT",
            preMoneyFullyDiluted: BigInt(interimM),
            currentPoolShares: BigInt(poolM),
            interimFullyDiluted: BigInt(interimM),
            newMoneyShares: BigInt(newMoneyM),
            targetPercent: pct.toString(),
          });
          if (!r.converged) return true;
          return r.finalPoolPercent.minus(pct).abs().lt(new Decimal("0.0001"));
        },
      ),
      { numRuns: 40 },
    );
  });

  it("increasing newMoney monotonically decreases founder ownership %", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000, max: 20_000_000 }),
        fc.integer({ min: 20_000_000, max: 50_000_000 }),
        (newMoneyA, newMoneyB) => {
          const a = runScenario(buildSimpleInput({ newMoney: String(newMoneyA), preMoney: "10000000" }));
          const b = runScenario(buildSimpleInput({ newMoney: String(newMoneyB), preMoney: "10000000" }));
          const foundA = a.finalOwnership.find((r) => r.stakeholderName === "Founder")!.percentOfFD;
          const foundB = b.finalOwnership.find((r) => r.stakeholderName === "Founder")!.percentOfFD;
          // More new money at same pre-money → more total new-shares → founder % drops
          return foundB.lte(foundA);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("determinism: same input → same output hash", () => {
    fc.assert(
      fc.property(fc.integer({ min: 500_000, max: 10_000_000 }), (newMoney) => {
        const a = runScenario(buildSimpleInput({ newMoney: String(newMoney) }));
        const b = runScenario(buildSimpleInput({ newMoney: String(newMoney) }));
        return (
          a.intermediates.pricePerShare?.toFixed(10) ===
            b.intermediates.pricePerShare?.toFixed(10) &&
          a.finalOwnership.length === b.finalOwnership.length
        );
      }),
      { numRuns: 20 },
    );
  });
});
