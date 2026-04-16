import Decimal from "decimal.js";

/**
 * PRD §9.8 — Option pool top-up solver.
 *
 * Modes:
 * - NONE: no change
 * - TO_TARGET_POST_MONEY_PERCENT: iterate until target met
 * - FIXED_SHARES: fixed number of additional shares
 * - FIXED_PERCENT_PRE_MONEY: additional = preMoneyFD × percent
 */

export type PoolTopUpMode =
  | "NONE"
  | "TO_TARGET_POST_MONEY_PERCENT"
  | "FIXED_SHARES"
  | "FIXED_PERCENT_PRE_MONEY";

export interface PoolTopUpInput {
  mode: PoolTopUpMode;
  preMoneyFullyDiluted: bigint;
  /** Current option pool (reserved + granted+active options, as defined by caller) */
  currentPoolShares: bigint;
  /** FD base before pool top-up but AFTER convertibles convert and before new money */
  interimFullyDiluted: bigint;
  /** For NEW_MONEY: additional shares that will be added for new investor money.
   *  Needed so that the solver targets post-money FD including the new money shares.
   */
  newMoneyShares: bigint;
  targetPercent?: Decimal | string | null;
  fixedShares?: bigint | null;
  fixedPercentPreMoney?: Decimal | string | null;
}

export interface PoolTopUpResult {
  additionalShares: bigint;
  iterations: number;
  converged: boolean;
  finalPoolPercent: Decimal;
  method: string;
}

const MAX_ITERATIONS = 100;

export function computePoolTopUp(input: PoolTopUpInput): PoolTopUpResult {
  const {
    mode,
    preMoneyFullyDiluted,
    currentPoolShares,
    interimFullyDiluted,
    newMoneyShares,
  } = input;

  if (mode === "NONE") {
    const fd = interimFullyDiluted + newMoneyShares;
    const finalPct = fd === 0n
      ? new Decimal(0)
      : new Decimal(currentPoolShares.toString()).div(fd.toString());
    return {
      additionalShares: 0n,
      iterations: 0,
      converged: true,
      finalPoolPercent: finalPct,
      method: "NONE: pool unchanged",
    };
  }

  if (mode === "FIXED_SHARES") {
    const add = input.fixedShares ?? 0n;
    const fd = interimFullyDiluted + add + newMoneyShares;
    const finalPct = fd === 0n
      ? new Decimal(0)
      : new Decimal((currentPoolShares + add).toString()).div(fd.toString());
    return {
      additionalShares: add,
      iterations: 0,
      converged: true,
      finalPoolPercent: finalPct,
      method: `FIXED_SHARES: ${add.toString()} shares added`,
    };
  }

  if (mode === "FIXED_PERCENT_PRE_MONEY") {
    if (input.fixedPercentPreMoney == null) {
      throw new Error("fixedPercentPreMoney required");
    }
    const pct = new Decimal(input.fixedPercentPreMoney);
    const addDec = new Decimal(preMoneyFullyDiluted.toString()).mul(pct).ceil();
    const add = BigInt(addDec.toFixed(0));
    const fd = interimFullyDiluted + add + newMoneyShares;
    const finalPct = fd === 0n
      ? new Decimal(0)
      : new Decimal((currentPoolShares + add).toString()).div(fd.toString());
    return {
      additionalShares: add,
      iterations: 0,
      converged: true,
      finalPoolPercent: finalPct,
      method: `FIXED_PERCENT_PRE_MONEY: ${pct.mul(100).toFixed(2)}% of preMoneyFD`,
    };
  }

  // TO_TARGET_POST_MONEY_PERCENT — iterative solver
  if (input.targetPercent == null) {
    throw new Error("targetPercent required for TO_TARGET_POST_MONEY_PERCENT");
  }
  const target = new Decimal(input.targetPercent);
  if (target.gte(1) || target.lte(0)) {
    // Target out of range -> do not converge
    return {
      additionalShares: 0n,
      iterations: 0,
      converged: false,
      finalPoolPercent: new Decimal(0),
      method: `TO_TARGET_POST_MONEY_PERCENT: target ${target.toString()} out of range (0,1)`,
    };
  }

  // Closed-form guess: target × postMoneyFD = currentPool + add
  //   postMoneyFD = interim + add + newMoneyShares
  //   add = (target × (interim + newMoneyShares) − currentPool) / (1 − target)
  const interimDec = new Decimal(interimFullyDiluted.toString());
  const newMoneyDec = new Decimal(newMoneyShares.toString());
  const currentPoolDec = new Decimal(currentPoolShares.toString());

  let add = target
    .mul(interimDec.add(newMoneyDec))
    .sub(currentPoolDec)
    .div(new Decimal(1).sub(target));
  if (add.lt(0)) add = new Decimal(0);
  let addShares = BigInt(add.ceil().toFixed(0));

  // Refine by iteration (handles rounding)
  let iterations = 0;
  let converged = false;
  let finalPct = new Decimal(0);
  for (iterations = 1; iterations <= MAX_ITERATIONS; iterations++) {
    const fd = interimFullyDiluted + addShares + newMoneyShares;
    if (fd === 0n) break;
    finalPct = new Decimal((currentPoolShares + addShares).toString()).div(fd.toString());
    const diff = target.sub(finalPct).abs();
    const epsilon = new Decimal(1).div(new Decimal(fd.toString()));
    if (diff.lte(epsilon)) {
      converged = true;
      break;
    }
    // Adjust by delta
    const needed = target.mul(new Decimal(fd.toString())).sub(currentPoolDec.add(new Decimal(addShares.toString())));
    const step = needed.div(new Decimal(1).sub(target)).ceil();
    const stepInt = BigInt(step.toFixed(0));
    if (stepInt === 0n) {
      converged = true;
      break;
    }
    addShares = addShares + stepInt;
    if (addShares < 0n) addShares = 0n;
  }

  return {
    additionalShares: addShares,
    iterations,
    converged,
    finalPoolPercent: finalPct,
    method: `TO_TARGET_POST_MONEY_PERCENT: target ${target.mul(100).toFixed(4)}%, solver converged=${converged} in ${iterations} iterations`,
  };
}
