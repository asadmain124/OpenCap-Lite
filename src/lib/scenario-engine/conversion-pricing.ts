import Decimal from "decimal.js";

/**
 * PRD §9.3 and §9.4 — SAFE / note conversion pricing with best-for-investor logic.
 *
 * discountPrice  = roundPricePerShare × (1 − discount/100)
 * capPrice       = valuationCap / capDenominatorShares
 *
 * BEST_FOR_INVESTOR picks min(cap, discount).
 * MFN with no terms returns UNRESOLVED_MFN.
 */

export interface ConversionPricingInput {
  valuationCap: Decimal | string | null;
  discountPercent: Decimal | string | null;
  mfn: boolean;
  capDenominatorShares: bigint;
  roundPricePerShare: Decimal | string;
  mode: "BEST_FOR_INVESTOR" | "CAP_ONLY" | "DISCOUNT_ONLY" | "USER_SELECTED";
  userSelectedMethod?: "CAP" | "DISCOUNT" | null;
}

export interface ConversionPricingResult {
  capPrice: Decimal | null;
  discountPrice: Decimal | null;
  effectivePrice: Decimal | null;
  selectedMethod: "CAP" | "DISCOUNT" | "UNRESOLVED_MFN";
  explanation: string;
}

export function computeConversionPrice(
  input: ConversionPricingInput,
): ConversionPricingResult {
  if (input.capDenominatorShares <= 0n) {
    throw new Error("capDenominatorShares must be > 0");
  }

  const roundPPS = new Decimal(input.roundPricePerShare);
  const hasCap = input.valuationCap != null;
  const hasDiscount =
    input.discountPercent != null &&
    !new Decimal(input.discountPercent).isZero();

  const capPrice = hasCap
    ? new Decimal(input.valuationCap as Decimal | string).div(
        input.capDenominatorShares.toString(),
      )
    : null;

  const discountPrice = hasDiscount
    ? roundPPS.mul(new Decimal(1).sub(new Decimal(input.discountPercent as Decimal | string).div(100)))
    : null;

  // MFN with no terms: unresolved
  if (!hasCap && !hasDiscount) {
    if (input.mfn) {
      return {
        capPrice: null,
        discountPrice: null,
        effectivePrice: null,
        selectedMethod: "UNRESOLVED_MFN",
        explanation:
          "MFN SAFE without explicit cap or discount — pricing cannot be determined until sibling terms are known.",
      };
    }
    throw new Error("Instrument has neither cap nor discount and is not MFN");
  }

  if (input.mode === "CAP_ONLY") {
    if (capPrice == null) {
      throw new Error("CAP_ONLY mode but instrument has no cap");
    }
    return {
      capPrice,
      discountPrice,
      effectivePrice: capPrice,
      selectedMethod: "CAP",
      explanation: `CAP_ONLY mode — using cap price of ${capPrice.toFixed(6)}`,
    };
  }

  if (input.mode === "DISCOUNT_ONLY") {
    if (discountPrice == null) {
      throw new Error("DISCOUNT_ONLY mode but instrument has no discount");
    }
    return {
      capPrice,
      discountPrice,
      effectivePrice: discountPrice,
      selectedMethod: "DISCOUNT",
      explanation: `DISCOUNT_ONLY mode — using discount price of ${discountPrice.toFixed(6)}`,
    };
  }

  if (input.mode === "USER_SELECTED") {
    if (input.userSelectedMethod === "CAP" && capPrice != null) {
      return {
        capPrice,
        discountPrice,
        effectivePrice: capPrice,
        selectedMethod: "CAP",
        explanation: `User selected CAP price of ${capPrice.toFixed(6)}`,
      };
    }
    if (input.userSelectedMethod === "DISCOUNT" && discountPrice != null) {
      return {
        capPrice,
        discountPrice,
        effectivePrice: discountPrice,
        selectedMethod: "DISCOUNT",
        explanation: `User selected DISCOUNT price of ${discountPrice.toFixed(6)}`,
      };
    }
    // Fallback to BEST_FOR_INVESTOR if user selection is invalid
  }

  // BEST_FOR_INVESTOR (default)
  if (capPrice != null && discountPrice != null) {
    if (capPrice.lte(discountPrice)) {
      return {
        capPrice,
        discountPrice,
        effectivePrice: capPrice,
        selectedMethod: "CAP",
        explanation: `Selected cap price of ${capPrice.toFixed(6)} because it is lower than or equal to discount price of ${discountPrice.toFixed(6)} under BEST_FOR_INVESTOR`,
      };
    }
    return {
      capPrice,
      discountPrice,
      effectivePrice: discountPrice,
      selectedMethod: "DISCOUNT",
      explanation: `Selected discount price of ${discountPrice.toFixed(6)} because it is lower than cap price of ${capPrice.toFixed(6)} under BEST_FOR_INVESTOR`,
    };
  }
  if (capPrice != null) {
    return {
      capPrice,
      discountPrice: null,
      effectivePrice: capPrice,
      selectedMethod: "CAP",
      explanation: `Only cap provided — using cap price of ${capPrice.toFixed(6)}`,
    };
  }
  return {
    capPrice: null,
    discountPrice: discountPrice!,
    effectivePrice: discountPrice!,
    selectedMethod: "DISCOUNT",
    explanation: `Only discount provided — using discount price of ${discountPrice!.toFixed(6)}`,
  };
}
