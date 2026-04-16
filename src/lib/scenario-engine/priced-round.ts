import Decimal from "decimal.js";

/**
 * PRD §9.5 — Priced round price per share.
 */
export interface PricedRoundInput {
  preMoneyValuation: Decimal | string | null;
  preMoneyDenominatorShares: bigint;
  pricedRoundPricePerShareOverride?: Decimal | string | null;
  methodLabel: string; // e.g. "CURRENT_FULLY_DILUTED"
}

export interface PricedRoundResult {
  pricePerShare: Decimal | null;
  method: string;
  denominatorUsed: bigint;
}

export function computePricedRoundPricePerShare(
  input: PricedRoundInput,
): PricedRoundResult {
  if (input.pricedRoundPricePerShareOverride != null) {
    return {
      pricePerShare: new Decimal(input.pricedRoundPricePerShareOverride),
      method: "user override",
      denominatorUsed: input.preMoneyDenominatorShares,
    };
  }
  if (input.preMoneyValuation == null) {
    return {
      pricePerShare: null,
      method: `preMoneyValuation / denominator (${input.methodLabel}) — no pre-money provided`,
      denominatorUsed: input.preMoneyDenominatorShares,
    };
  }
  if (input.preMoneyDenominatorShares <= 0n) {
    throw new Error("preMoneyDenominatorShares must be > 0");
  }
  const pps = new Decimal(input.preMoneyValuation).div(
    input.preMoneyDenominatorShares.toString(),
  );
  return {
    pricePerShare: pps,
    method: `preMoneyValuation / denominator (${input.methodLabel})`,
    denominatorUsed: input.preMoneyDenominatorShares,
  };
}
