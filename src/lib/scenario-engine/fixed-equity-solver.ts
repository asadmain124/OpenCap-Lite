import Decimal from "decimal.js";

/**
 * PRD §9.7 — Fixed equity percent template (accelerators).
 *
 * sharesToIssue = (targetPercent × existingShares) / (1 − targetPercent)
 * Rounds up to nearest whole share. Throws if targetPercent >= 1.
 */
export interface FixedEquityInput {
  targetPercent: Decimal | string; // as fraction 0-1 (0.07 for 7%)
  existingShares: bigint;
}

export interface FixedEquityResult {
  sharesToIssue: bigint;
  formula: string;
  resultingPercent: Decimal;
}

export function solveFixedEquityShares(
  input: FixedEquityInput,
): FixedEquityResult {
  const target = new Decimal(input.targetPercent);
  if (target.gte(1)) {
    throw new Error("targetPercent must be < 1");
  }
  if (target.lte(0)) {
    throw new Error("targetPercent must be > 0");
  }
  const existing = new Decimal(input.existingShares.toString());
  const numerator = target.mul(existing);
  const denominator = new Decimal(1).sub(target);
  const exact = numerator.div(denominator);
  const shares = BigInt(exact.ceil().toFixed(0));
  const resultingPercent = new Decimal(shares.toString()).div(
    existing.add(new Decimal(shares.toString())),
  );
  const formula = `(${target.toString()} × ${existing.toFixed(0)}) / (1 − ${target.toString()}) = ${shares.toString()} shares`;
  return {
    sharesToIssue: shares,
    formula,
    resultingPercent,
  };
}
