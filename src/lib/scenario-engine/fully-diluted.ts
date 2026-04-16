/**
 * PRD §9.1 — Fully Diluted share count.
 *
 * FD = sum(EquityHolding.shareCount where ACTIVE)
 *    + sum(OptionGrant.optionCount - cancelledCount where ACTIVE)
 *    + (reservedUngrantedPool ?? 0)
 *
 * Pure. No floats. BigInt arithmetic throughout.
 */

export interface FullyDilutedInput {
  holdings: { shareCount: bigint; status: "ACTIVE" | "CANCELLED" | "REPURCHASED" }[];
  optionGrants: {
    optionCount: bigint;
    cancelledCount: bigint;
    status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  }[];
  reservedUngrantedPool: bigint;
  settings: {
    includeAllGrantedOptions: boolean;
    includeCancelledGrants: boolean;
    includeReservedUngranted: boolean;
  };
}

export interface FullyDilutedResult {
  fullyDiluted: bigint;
  breakdown: {
    common: bigint;
    options: bigint;
    reserved: bigint;
  };
}

export function computeFullyDiluted(input: FullyDilutedInput): FullyDilutedResult {
  const { holdings, optionGrants, reservedUngrantedPool, settings } = input;

  let common = 0n;
  for (const h of holdings) {
    if (h.status === "ACTIVE") common += h.shareCount;
  }

  let options = 0n;
  if (settings.includeAllGrantedOptions) {
    for (const g of optionGrants) {
      const isCancelled = g.status === "CANCELLED" || g.status === "EXPIRED";
      if (isCancelled && !settings.includeCancelledGrants) continue;
      options += g.optionCount - g.cancelledCount;
    }
  }

  const reserved = settings.includeReservedUngranted ? reservedUngrantedPool : 0n;

  const fullyDiluted = common + options + reserved;
  return { fullyDiluted, breakdown: { common, options, reserved } };
}
