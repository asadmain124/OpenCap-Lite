import Decimal from "decimal.js";
import { computeFullyDiluted } from "./fully-diluted";
import { computeAccruedInterest } from "./note-interest";
import { computeConversionPrice } from "./conversion-pricing";
import { computePricedRoundPricePerShare } from "./priced-round";
import { solveFixedEquityShares } from "./fixed-equity-solver";
import { computePoolTopUp } from "./pool-topup";
import type {
  BaselineHolding,
  BaselineNote,
  BaselineOptionGrant,
  BaselineSAFE,
  ConvertibleDetail,
  NewInstrument,
  OwnershipRow,
  ScenarioInput,
  ScenarioResult,
  StageSnapshot,
  Warning,
} from "./types";

Decimal.set({ precision: 40 });

interface WorkingState {
  // shares by "bucket"
  commonByStakeholder: Map<string, { name: string; shares: bigint }>;
  preferredByStakeholder: Map<string, { name: string; shares: bigint }>;
  optionsByStakeholder: Map<string, { name: string; shares: bigint }>;
  convertedBySafe: Map<
    string,
    { stakeholderName: string; label: string; shares: bigint }
  >;
  convertedByNote: Map<
    string,
    { stakeholderName: string; label: string; shares: bigint }
  >;
  newEquityByLabel: Map<
    string,
    { stakeholderName: string; label: string; shares: bigint }
  >;
  reservedPool: bigint;
}

function initWorking(input: ScenarioInput): WorkingState {
  const commonByStakeholder = new Map<string, { name: string; shares: bigint }>();
  const preferredByStakeholder = new Map<string, { name: string; shares: bigint }>();
  for (const h of input.baseline.holdings) {
    if (h.status !== "ACTIVE") continue;
    const bucket =
      h.securityType === "PREFERRED" ? preferredByStakeholder : commonByStakeholder;
    const cur = bucket.get(h.stakeholderId) ?? {
      name: h.stakeholderName,
      shares: 0n,
    };
    cur.shares += h.shareCount;
    bucket.set(h.stakeholderId, cur);
  }

  const optionsByStakeholder = new Map<string, { name: string; shares: bigint }>();
  const includeCancelled = input.settings?.includeCancelledGrants ?? false;
  for (const g of input.baseline.optionGrants) {
    const isCancelled = g.status === "CANCELLED" || g.status === "EXPIRED";
    if (isCancelled && !includeCancelled) continue;
    const cur = optionsByStakeholder.get(g.stakeholderId) ?? {
      name: g.stakeholderName,
      shares: 0n,
    };
    cur.shares += g.optionCount - g.cancelledCount;
    optionsByStakeholder.set(g.stakeholderId, cur);
  }

  return {
    commonByStakeholder,
    preferredByStakeholder,
    optionsByStakeholder,
    convertedBySafe: new Map(),
    convertedByNote: new Map(),
    newEquityByLabel: new Map(),
    reservedPool: BigInt(input.baseline.reservedUngrantedPool || "0"),
  };
}

function sumMap(m: Map<string, { shares: bigint }>): bigint {
  let total = 0n;
  for (const v of m.values()) total += v.shares;
  return total;
}

function currentFD(state: WorkingState): bigint {
  return (
    sumMap(state.commonByStakeholder) +
    sumMap(state.preferredByStakeholder) +
    sumMap(state.optionsByStakeholder) +
    sumMap(state.convertedBySafe) +
    sumMap(state.convertedByNote) +
    sumMap(state.newEquityByLabel) +
    state.reservedPool
  );
}

function ownershipFromState(state: WorkingState): OwnershipRow[] {
  const fd = currentFD(state);
  const fdDec = fd === 0n ? new Decimal(1) : new Decimal(fd.toString());
  const rows: OwnershipRow[] = [];

  const add = (
    group: OwnershipRow["group"],
    securityType: string,
    id: string | null,
    name: string,
    shares: bigint,
  ) => {
    if (shares === 0n) return;
    rows.push({
      stakeholderId: id,
      stakeholderName: name,
      securityType,
      shareCount: shares,
      fullyDilutedShares: fd,
      percentOfFD: new Decimal(shares.toString()).div(fdDec).mul(100),
      group,
    });
  };

  for (const [id, v] of state.commonByStakeholder) add("common", "Common", id, v.name, v.shares);
  for (const [id, v] of state.preferredByStakeholder) add("preferred", "Preferred", id, v.name, v.shares);
  for (const [id, v] of state.optionsByStakeholder) add("options", "Options", id, v.name, v.shares);
  for (const [id, v] of state.convertedBySafe) add("safe", "SAFE Converted", id, `${v.stakeholderName} — ${v.label}`, v.shares);
  for (const [id, v] of state.convertedByNote) add("note", "Note Converted", id, `${v.stakeholderName} — ${v.label}`, v.shares);
  for (const [id, v] of state.newEquityByLabel) add("new_money", "New Equity", id, `${v.stakeholderName} — ${v.label}`, v.shares);
  if (state.reservedPool > 0n) add("reserved_pool", "Option Pool Reserved", null, "Reserved Pool", state.reservedPool);

  rows.sort((a, b) => (a.shareCount > b.shareCount ? -1 : 1));
  return rows;
}

function snapshot(state: WorkingState, stageName: string, description: string): StageSnapshot {
  return {
    stageName,
    description,
    fullyDiluted: currentFD(state),
    ownership: ownershipFromState(state),
  };
}

function computeDenominator(
  method: "CURRENT_FULLY_DILUTED" | "FULLY_DILUTED_EXCLUDING_CONVERTIBLES" | "USER_OVERRIDE",
  override: string | null | undefined,
  state: WorkingState,
  excludeConvertibles: boolean,
): bigint {
  if (method === "USER_OVERRIDE") {
    if (!override) throw new Error("USER_OVERRIDE method requires override value");
    return BigInt(override);
  }
  const base =
    sumMap(state.commonByStakeholder) +
    sumMap(state.preferredByStakeholder) +
    sumMap(state.optionsByStakeholder) +
    state.reservedPool;
  if (excludeConvertibles || method === "FULLY_DILUTED_EXCLUDING_CONVERTIBLES") {
    return base;
  }
  return (
    base +
    sumMap(state.convertedBySafe) +
    sumMap(state.convertedByNote) +
    sumMap(state.newEquityByLabel)
  );
}

/**
 * MFN ("most favored nation") sibling inference: if a SAFE/note is MFN and has
 * no explicit cap or discount, inherit the best-for-investor terms from its
 * non-MFN siblings of the same type — lowest non-null cap and highest non-null
 * discount across siblings. This matches common legal practice: the MFN right
 * is only meaningful if the holder can actually pull in sibling terms.
 *
 * Returns a new array with effective (post-inference) copies. Does not mutate
 * inputs. Emits a "high" warning if inference applied.
 */
function inferMfnTermsForSafes(
  safes: BaselineSAFE[],
  warnings: Warning[],
): BaselineSAFE[] {
  const siblingCaps: Decimal[] = [];
  const siblingDiscounts: Decimal[] = [];
  for (const s of safes) {
    if (s.status !== "OUTSTANDING") continue;
    if (s.mfn) continue;
    if (s.valuationCap) siblingCaps.push(new Decimal(s.valuationCap));
    if (s.discountPercent) siblingDiscounts.push(new Decimal(s.discountPercent));
  }
  const bestCap = siblingCaps.length > 0
    ? siblingCaps.reduce((m, c) => (c.lt(m) ? c : m))
    : null;
  const bestDiscount = siblingDiscounts.length > 0
    ? siblingDiscounts.reduce((m, d) => (d.gt(m) ? d : m))
    : null;

  return safes.map((s) => {
    if (!s.mfn) return s;
    const hasOwnTerms =
      (s.valuationCap != null) ||
      (s.discountPercent != null && !new Decimal(s.discountPercent).isZero());
    if (hasOwnTerms) return s;
    if (bestCap == null && bestDiscount == null) return s; // stays unresolved
    warnings.push({
      code: "MFN_INFERRED",
      severity: "medium",
      message: `SAFE "${s.label ?? s.id}" MFN terms inferred from siblings: ${bestCap ? `cap=${bestCap.toString()}` : "no cap"}${bestCap && bestDiscount ? ", " : ""}${bestDiscount ? `discount=${bestDiscount.toString()}%` : ""}`,
      entityType: "SAFE",
      entityId: s.id,
    });
    return {
      ...s,
      valuationCap: bestCap ? bestCap.toString() : null,
      discountPercent: bestDiscount ? bestDiscount.toString() : null,
    };
  });
}

function inferMfnTermsForNotes(
  notes: BaselineNote[],
  warnings: Warning[],
): BaselineNote[] {
  const siblingCaps: Decimal[] = [];
  const siblingDiscounts: Decimal[] = [];
  for (const n of notes) {
    if (n.status !== "OUTSTANDING") continue;
    if (n.mfn) continue;
    if (n.valuationCap) siblingCaps.push(new Decimal(n.valuationCap));
    if (n.discountPercent) siblingDiscounts.push(new Decimal(n.discountPercent));
  }
  const bestCap = siblingCaps.length > 0
    ? siblingCaps.reduce((m, c) => (c.lt(m) ? c : m))
    : null;
  const bestDiscount = siblingDiscounts.length > 0
    ? siblingDiscounts.reduce((m, d) => (d.gt(m) ? d : m))
    : null;

  return notes.map((n) => {
    if (!n.mfn) return n;
    const hasOwnTerms =
      (n.valuationCap != null) ||
      (n.discountPercent != null && !new Decimal(n.discountPercent).isZero());
    if (hasOwnTerms) return n;
    if (bestCap == null && bestDiscount == null) return n;
    warnings.push({
      code: "MFN_INFERRED",
      severity: "medium",
      message: `Note "${n.label ?? n.id}" MFN terms inferred from siblings: ${bestCap ? `cap=${bestCap.toString()}` : "no cap"}${bestCap && bestDiscount ? ", " : ""}${bestDiscount ? `discount=${bestDiscount.toString()}%` : ""}`,
      entityType: "NOTE",
      entityId: n.id,
    });
    return {
      ...n,
      valuationCap: bestCap ? bestCap.toString() : null,
      discountPercent: bestDiscount ? bestDiscount.toString() : null,
    };
  });
}

/**
 * Convert SAFEs and notes together, with a fixed-point iteration so YC 2018
 * post-money SAFEs honor the self-referential "Company Capitalization"
 * definition that includes all converting securities.
 *
 * - Pre-money SAFEs (YC 2013) use capDenomPreMoney (constant — baseline +
 *   projected pool top-up, excludes other convertibles). Computed once.
 * - Post-money SAFEs (YC 2018) and notes share a post-money-style denominator
 *   that equals capDenomPostMoney PLUS the current estimate of all converting
 *   shares (pre-money SAFE shares + other post-money SAFE shares + note
 *   shares). Iterated until the total stabilizes.
 */
function convertConvertibles(
  state: WorkingState,
  safesRaw: BaselineSAFE[],
  notesRaw: BaselineNote[],
  accrualDate: Date,
  roundPPS: Decimal | null,
  capDenomPostMoney: bigint,
  capDenomPreMoney: bigint,
  safesMode: "BEST_FOR_INVESTOR" | "CAP_ONLY" | "DISCOUNT_ONLY" | "USER_SELECTED_PER_SAFE",
  notesMode: "BEST_FOR_INVESTOR" | "CAP_ONLY" | "DISCOUNT_ONLY" | "USER_SELECTED_PER_NOTE",
  details: ConvertibleDetail[],
  warnings: Warning[],
  formulaTrace: string[],
): void {
  if (roundPPS == null) return;

  const safes = inferMfnTermsForSafes(safesRaw, warnings);
  const notes = inferMfnTermsForNotes(notesRaw, warnings);

  // Precompute note accruals (interest doesn't depend on pricing denominator).
  const noteAccruals = new Map<string, ReturnType<typeof computeAccruedInterest>>();
  for (const n of notes) {
    if (n.status !== "OUTSTANDING") continue;
    noteAccruals.set(
      n.id,
      computeAccruedInterest({
        principal: n.principal,
        annualInterestRatePercent: n.annualInterestRatePercent,
        interestType: n.interestType,
        compoundingFrequencyPerYear: n.compoundingFrequencyPerYear,
        issueDate: new Date(n.issueDate),
        accrualCutoffDate: accrualDate,
        dayCountConvention: n.dayCountConvention ?? "ACT_365",
      }),
    );
    if (n.maturityDate) {
      const mat = new Date(n.maturityDate);
      if (mat < accrualDate) {
        warnings.push({
          code: "NOTE_PAST_MATURITY",
          severity: "medium",
          message: `Note "${n.label ?? n.id}" matured on ${n.maturityDate} before round close date`,
          entityType: "NOTE",
          entityId: n.id,
        });
      }
    }
  }

  // Pre-money SAFE shares are deterministic (denom does not depend on other
  // convertibles). Compute once.
  const preMoneyResults = new Map<
    string,
    { pricing: ReturnType<typeof computeConversionPrice>; shares: bigint }
  >();
  let preMoneyTotalShares = 0n;
  for (const s of safes) {
    if (s.status !== "OUTSTANDING") continue;
    if (s.postMoney) continue;
    const effectiveMode =
      safesMode === "USER_SELECTED_PER_SAFE" ? "USER_SELECTED" : safesMode;
    const pricing = computeConversionPrice({
      valuationCap: s.valuationCap,
      discountPercent: s.discountPercent,
      mfn: s.mfn,
      capDenominatorShares: capDenomPreMoney,
      roundPricePerShare: roundPPS,
      mode: effectiveMode,
      userSelectedMethod: s.userSelectedMethod ?? null,
    });
    let shares = 0n;
    if (pricing.selectedMethod !== "UNRESOLVED_MFN") {
      shares = BigInt(
        new Decimal(s.purchaseAmount).div(pricing.effectivePrice!).floor().toFixed(0),
      );
    }
    preMoneyResults.set(s.id, { pricing, shares });
    preMoneyTotalShares += shares;
  }

  // Notes use the base "company capitalization" (capDenomPostMoney) — no
  // self-reference, matching Cooley/Fenwick standard note templates where the
  // denominator at conversion excludes shares issued from the note itself.
  // Notes do NOT iterate; post-money SAFEs see them in their denom via
  // noteTotalShares (pre-computed below).
  const noteResults = new Map<
    string,
    { pricing: ReturnType<typeof computeConversionPrice>; shares: bigint }
  >();
  let noteTotalShares = 0n;
  for (const n of notes) {
    if (n.status !== "OUTSTANDING") continue;
    const accrual = noteAccruals.get(n.id)!;
    const effectiveMode =
      notesMode === "USER_SELECTED_PER_NOTE" ? "USER_SELECTED" : notesMode;
    const pricing = computeConversionPrice({
      valuationCap: n.valuationCap,
      discountPercent: n.discountPercent,
      mfn: n.mfn,
      capDenominatorShares: capDenomPostMoney,
      roundPricePerShare: roundPPS,
      mode: effectiveMode,
      userSelectedMethod: n.userSelectedMethod ?? null,
    });
    let shares = 0n;
    if (pricing.selectedMethod !== "UNRESOLVED_MFN") {
      shares = BigInt(
        accrual.totalConversionAmount.div(pricing.effectivePrice!).floor().toFixed(0),
      );
    }
    noteResults.set(n.id, { pricing, shares });
    noteTotalShares += shares;
  }

  // Fixed-point iteration for post-money SAFEs only — YC 2018 "Company
  // Capitalization" is self-referential (includes this SAFE and all other
  // Converting Securities).
  // iterDenomBase = capDenomPostMoney + preMoneyTotalShares + noteTotalShares.
  // iterDenom = iterDenomBase + sum(current post-money SAFE shares).
  const iterDenomBase =
    capDenomPostMoney + preMoneyTotalShares + noteTotalShares;
  let iterDenom = iterDenomBase;
  let previousTotal = -1n;
  const MAX_ITER = 50;
  let iterations = 0;

  let postMoneyResults = new Map<
    string,
    { pricing: ReturnType<typeof computeConversionPrice>; shares: bigint }
  >();

  for (iterations = 1; iterations <= MAX_ITER; iterations++) {
    postMoneyResults = new Map();
    let total = 0n;

    for (const s of safes) {
      if (s.status !== "OUTSTANDING") continue;
      if (!s.postMoney) continue;
      const effectiveMode =
        safesMode === "USER_SELECTED_PER_SAFE" ? "USER_SELECTED" : safesMode;
      const pricing = computeConversionPrice({
        valuationCap: s.valuationCap,
        discountPercent: s.discountPercent,
        mfn: s.mfn,
        capDenominatorShares: iterDenom,
        roundPricePerShare: roundPPS,
        mode: effectiveMode,
        userSelectedMethod: s.userSelectedMethod ?? null,
      });
      let shares = 0n;
      if (pricing.selectedMethod !== "UNRESOLVED_MFN") {
        shares = BigInt(
          new Decimal(s.purchaseAmount).div(pricing.effectivePrice!).floor().toFixed(0),
        );
      }
      postMoneyResults.set(s.id, { pricing, shares });
      total += shares;
    }

    if (total === previousTotal) break; // converged
    previousTotal = total;
    iterDenom = iterDenomBase + total;
  }

  if (iterations > MAX_ITER) {
    warnings.push({
      code: "POST_MONEY_SAFE_NON_CONVERGENT",
      severity: "high",
      message: `Post-money SAFE / note denominator solver did not converge within ${MAX_ITER} iterations`,
    });
  }
  if (iterations > 1 && safes.some((s) => s.postMoney && s.status === "OUTSTANDING")) {
    formulaTrace.push(
      `Post-money SAFE denominator solver converged in ${iterations} iteration(s); final denom = ${iterDenom.toString()}`,
    );
  }

  const applySafe = (
    s: BaselineSAFE,
    pricing: ReturnType<typeof computeConversionPrice>,
    shares: bigint,
    denom: bigint,
  ) => {
    if (pricing.selectedMethod === "UNRESOLVED_MFN") {
      warnings.push({
        code: "MFN_UNRESOLVED",
        severity: "high",
        message: `SAFE "${s.label ?? s.id}" is MFN with no explicit terms — excluded from conversion`,
        entityType: "SAFE",
        entityId: s.id,
      });
      details.push({
        instrumentType: "SAFE",
        instrumentId: s.id,
        stakeholderName: s.stakeholderName,
        label: s.label ?? s.id,
        principal: new Decimal(s.purchaseAmount),
        accruedInterest: new Decimal(0),
        totalConversionAmount: new Decimal(s.purchaseAmount),
        capPrice: pricing.capPrice,
        discountPrice: pricing.discountPrice,
        selectedPrice: null,
        selectedMethod: "UNRESOLVED_MFN",
        sharesIssued: 0n,
        explanation: pricing.explanation,
      });
      return;
    }
    const price = pricing.effectivePrice!;
    const purchase = new Decimal(s.purchaseAmount);
    const cur = state.convertedBySafe.get(s.id) ?? {
      stakeholderName: s.stakeholderName,
      label: s.label ?? "SAFE",
      shares: 0n,
    };
    cur.shares += shares;
    state.convertedBySafe.set(s.id, cur);
    details.push({
      instrumentType: "SAFE",
      instrumentId: s.id,
      stakeholderName: s.stakeholderName,
      label: s.label ?? s.id,
      principal: purchase,
      accruedInterest: new Decimal(0),
      totalConversionAmount: purchase,
      capPrice: pricing.capPrice,
      discountPrice: pricing.discountPrice,
      selectedPrice: price,
      selectedMethod: pricing.selectedMethod,
      sharesIssued: shares,
      explanation: pricing.explanation,
    });
    const safeType = s.postMoney ? "post-money" : "pre-money";
    formulaTrace.push(
      `SAFE ${s.label ?? s.id} (${safeType}, capDenom=${denom.toString()}): ${purchase.toFixed(2)} / ${price.toFixed(6)} = ${shares.toString()} shares (${pricing.explanation})`,
    );
  };

  const applyNote = (
    n: BaselineNote,
    pricing: ReturnType<typeof computeConversionPrice>,
    shares: bigint,
    denom: bigint,
  ) => {
    const accrual = noteAccruals.get(n.id)!;
    if (pricing.selectedMethod === "UNRESOLVED_MFN") {
      warnings.push({
        code: "MFN_UNRESOLVED",
        severity: "high",
        message: `Note "${n.label ?? n.id}" is MFN with no explicit terms`,
        entityType: "NOTE",
        entityId: n.id,
      });
      details.push({
        instrumentType: "NOTE",
        instrumentId: n.id,
        stakeholderName: n.stakeholderName,
        label: n.label ?? n.id,
        principal: new Decimal(n.principal),
        accruedInterest: accrual.accruedInterest,
        totalConversionAmount: accrual.totalConversionAmount,
        capPrice: pricing.capPrice,
        discountPrice: pricing.discountPrice,
        selectedPrice: null,
        selectedMethod: "UNRESOLVED_MFN",
        sharesIssued: 0n,
        explanation: pricing.explanation,
      });
      return;
    }
    const price = pricing.effectivePrice!;
    const cur = state.convertedByNote.get(n.id) ?? {
      stakeholderName: n.stakeholderName,
      label: n.label ?? "Note",
      shares: 0n,
    };
    cur.shares += shares;
    state.convertedByNote.set(n.id, cur);
    details.push({
      instrumentType: "NOTE",
      instrumentId: n.id,
      stakeholderName: n.stakeholderName,
      label: n.label ?? n.id,
      principal: new Decimal(n.principal),
      accruedInterest: accrual.accruedInterest,
      totalConversionAmount: accrual.totalConversionAmount,
      capPrice: pricing.capPrice,
      discountPrice: pricing.discountPrice,
      selectedPrice: price,
      selectedMethod: pricing.selectedMethod,
      sharesIssued: shares,
      explanation: pricing.explanation,
    });
    formulaTrace.push(
      `Note ${n.label ?? n.id} (capDenom=${denom.toString()}, ${accrual.method}): accrued ${accrual.accruedInterest.toFixed(2)}, total ${accrual.totalConversionAmount.toFixed(2)} / ${price.toFixed(6)} = ${shares.toString()} shares`,
    );
  };

  // Apply in deterministic source order: SAFEs first, then notes.
  for (const s of safes) {
    if (s.status !== "OUTSTANDING") continue;
    if (!s.postMoney) {
      const r = preMoneyResults.get(s.id)!;
      applySafe(s, r.pricing, r.shares, capDenomPreMoney);
    } else {
      const r = postMoneyResults.get(s.id)!;
      applySafe(s, r.pricing, r.shares, iterDenom);
    }
  }
  for (const n of notes) {
    if (n.status !== "OUTSTANDING") continue;
    const r = noteResults.get(n.id)!;
    applyNote(n, r.pricing, r.shares, capDenomPostMoney);
  }
}

function applyNewInstruments(
  state: WorkingState,
  instruments: NewInstrument[],
  pps: Decimal | null,
  formulaTrace: string[],
): bigint {
  let newMoneyShares = 0n;
  for (let idx = 0; idx < instruments.length; idx++) {
    const inst = instruments[idx];
    const key = `${inst.type}:${idx}:${inst.label}`;
    if (inst.type === "NEW_EQUITY") {
      if (pps == null) continue;
      const amount = new Decimal(inst.investmentAmount ?? inst.purchaseAmount ?? 0);
      const shares = BigInt(amount.div(pps).floor().toFixed(0));
      state.newEquityByLabel.set(key, {
        stakeholderName: inst.stakeholderName,
        label: inst.label,
        shares,
      });
      newMoneyShares += shares;
      formulaTrace.push(`New equity ${inst.label}: ${amount.toFixed(2)} / ${pps.toFixed(6)} = ${shares.toString()} shares`);
    } else if (inst.type === "NEW_ACCELERATOR_EQUITY") {
      const target = new Decimal(inst.targetEquityPercent ?? "0");
      const existing = currentFD(state);
      const solved = solveFixedEquityShares({
        targetPercent: target.div(target.gt(1) ? 100 : 1),
        existingShares: existing,
      });
      state.newEquityByLabel.set(key, {
        stakeholderName: inst.stakeholderName,
        label: inst.label,
        shares: solved.sharesToIssue,
      });
      newMoneyShares += solved.sharesToIssue;
      formulaTrace.push(`Accelerator ${inst.label}: ${solved.formula}`);
    } else if (inst.type === "NEW_SAFE") {
      // New SAFE is not yet converted; it becomes part of baseline for future rounds.
      // For now, surface it in details only.
      formulaTrace.push(`New SAFE ${inst.label}: $${inst.purchaseAmount ?? "?"} outstanding (not converting in this round)`);
    } else if (inst.type === "NEW_NOTE") {
      formulaTrace.push(`New note ${inst.label}: $${inst.principal ?? "?"} outstanding (not converting in this round)`);
    }
  }
  return newMoneyShares;
}

export function runScenario(input: ScenarioInput): ScenarioResult {
  const warnings: Warning[] = [];
  const formulaTrace: string[] = [];
  const stages: StageSnapshot[] = [];
  const details: ConvertibleDetail[] = [];

  const state = initWorking(input);

  // Baseline FD
  const baselineFD = computeFullyDiluted({
    holdings: input.baseline.holdings.map((h) => ({
      shareCount: h.shareCount,
      status: h.status,
    })),
    optionGrants: input.baseline.optionGrants.map((g) => ({
      optionCount: g.optionCount,
      cancelledCount: g.cancelledCount,
      status: g.status,
    })),
    reservedUngrantedPool: BigInt(input.baseline.reservedUngrantedPool || "0"),
    settings: {
      includeAllGrantedOptions: input.settings?.includeAllGrantedOptions ?? true,
      includeCancelledGrants: input.settings?.includeCancelledGrants ?? false,
      includeReservedUngranted: input.settings?.includeReservedUngranted ?? true,
    },
  });

  stages.push(snapshot(state, "BASELINE", "Initial cap table before any scenario changes"));

  const round = input.round;
  const accrualDate = new Date(round.roundCloseDate);

  // Cap denominator for post-money SAFEs / notes (YC 2018 convention and notes).
  // Evaluated before conversions run, so "CURRENT_FULLY_DILUTED" here reduces to
  // common + preferred + options + reserved pool (existing pool, no top-up yet).
  const capDenom = computeDenominator(
    round.capDenominatorMethod,
    round.capDenominatorOverride ?? null,
    state,
    false,
  );

  // Pre-money denominator (for PPS)
  const preMoneyDenom = computeDenominator(
    round.preMoneyDenominatorMethod,
    round.preMoneyDenominatorOverride ?? null,
    state,
    round.preMoneyDenominatorMethod === "FULLY_DILUTED_EXCLUDING_CONVERTIBLES",
  );

  const ppsResult = computePricedRoundPricePerShare({
    preMoneyValuation: round.preMoneyValuation ?? null,
    preMoneyDenominatorShares: preMoneyDenom,
    pricedRoundPricePerShareOverride: round.pricedRoundPricePerShareOverride ?? null,
    methodLabel: round.preMoneyDenominatorMethod,
  });

  const pricePerShare = ppsResult.pricePerShare;
  if (pricePerShare != null && pricePerShare.lte(0)) {
    warnings.push({
      code: "INCONSISTENT_PPS",
      severity: "high",
      message: "Price per share is less than or equal to zero — check pre-money and denominator inputs",
    });
  }

  // Pre-money SAFE (YC 2013) cap denominator: baseline FD plus the new option
  // pool top-up, excluding other SAFEs / notes. Project the top-up deterministically
  // so pre-money SAFEs price correctly regardless of conversion-ordering rule.
  const estNewMoneyShares =
    pricePerShare != null && pricePerShare.gt(0) && round.newMoney
      ? BigInt(new Decimal(round.newMoney).div(pricePerShare).floor().toFixed(0))
      : 0n;
  const hasPreMoneySafe = input.baseline.safes.some(
    (s) => !s.postMoney && s.status === "OUTSTANDING",
  );
  let projectedPoolTopUp = 0n;
  if (hasPreMoneySafe && round.optionPoolTopUpMode !== "NONE") {
    const projected = computePoolTopUp({
      mode: round.optionPoolTopUpMode,
      preMoneyFullyDiluted: baselineFD.fullyDiluted,
      currentPoolShares: state.reservedPool,
      interimFullyDiluted: baselineFD.fullyDiluted,
      newMoneyShares: estNewMoneyShares,
      targetPercent: round.optionPoolTargetPercent ?? null,
      fixedShares: round.optionPoolFixedShares
        ? BigInt(round.optionPoolFixedShares)
        : null,
      fixedPercentPreMoney: round.optionPoolFixedPercentPreMoney ?? null,
    });
    projectedPoolTopUp = projected.additionalShares;
  }
  const capDenomPreMoney = capDenom + projectedPoolTopUp;

  formulaTrace.push(
    `Baseline FD = ${baselineFD.fullyDiluted.toString()} (common=${baselineFD.breakdown.common}, options=${baselineFD.breakdown.options}, reserved=${baselineFD.breakdown.reserved})`,
  );
  formulaTrace.push(`Pre-money denominator (${round.preMoneyDenominatorMethod}) = ${preMoneyDenom.toString()}`);
  formulaTrace.push(`Cap denominator post-money SAFEs = ${capDenom.toString()}`);
  if (hasPreMoneySafe) {
    formulaTrace.push(
      `Cap denominator pre-money SAFEs = ${capDenomPreMoney.toString()} (includes projected pool top-up of ${projectedPoolTopUp.toString()})`,
    );
  }
  if (pricePerShare) {
    formulaTrace.push(`Price per share = ${pricePerShare.toFixed(6)} (${ppsResult.method})`);
  }

  const doConvertibles = () => {
    if (pricePerShare == null) return;
    convertConvertibles(
      state,
      input.baseline.safes,
      input.baseline.notes,
      accrualDate,
      pricePerShare,
      capDenom,
      capDenomPreMoney,
      round.safesConvertUsing,
      round.notesConvertUsing,
      details,
      warnings,
      formulaTrace,
    );
    stages.push(snapshot(state, "CONVERSIONS", "After SAFE and note conversions"));
  };

  let poolTopUpShares = 0n;
  let poolTopUpMethod = "NONE";

  const doPoolTopUp = () => {
    const preMoneyFD = baselineFD.fullyDiluted;
    const interimFD = currentFD(state);
    // Estimate newMoneyShares for target calculation
    const newMoney = round.newMoney ? new Decimal(round.newMoney) : new Decimal(0);
    const estNewMoneyShares =
      pricePerShare != null && pricePerShare.gt(0)
        ? BigInt(newMoney.div(pricePerShare).floor().toFixed(0))
        : 0n;

    const topUp = computePoolTopUp({
      mode: round.optionPoolTopUpMode,
      preMoneyFullyDiluted: preMoneyFD,
      currentPoolShares: state.reservedPool,
      interimFullyDiluted: interimFD,
      newMoneyShares: estNewMoneyShares,
      targetPercent: round.optionPoolTargetPercent ?? null,
      fixedShares: round.optionPoolFixedShares ? BigInt(round.optionPoolFixedShares) : null,
      fixedPercentPreMoney: round.optionPoolFixedPercentPreMoney ?? null,
    });
    if (!topUp.converged && round.optionPoolTopUpMode === "TO_TARGET_POST_MONEY_PERCENT") {
      warnings.push({
        code: "POOL_NON_CONVERGENT",
        severity: "medium",
        message: `Pool top-up solver did not converge within ${topUp.iterations} iterations`,
      });
    }
    state.reservedPool += topUp.additionalShares;
    poolTopUpShares = topUp.additionalShares;
    poolTopUpMethod = topUp.method;
    formulaTrace.push(`Pool top-up: ${topUp.method} → added ${topUp.additionalShares.toString()} shares`);
    stages.push(snapshot(state, "POOL_TOPUP", "After option pool top-up"));
  };

  let newMoneyShares = 0n;

  const doNewMoney = () => {
    if (input.newInstruments.length > 0) {
      newMoneyShares += applyNewInstruments(state, input.newInstruments, pricePerShare, formulaTrace);
    } else if (pricePerShare != null && round.newMoney) {
      // Implicit new investor (no explicit instrument row)
      const shares = BigInt(new Decimal(round.newMoney).div(pricePerShare).floor().toFixed(0));
      const key = "NEW_MONEY:implicit";
      state.newEquityByLabel.set(key, {
        stakeholderName: "New Investor",
        label: "Lead Investor",
        shares,
      });
      newMoneyShares += shares;
      formulaTrace.push(`Implicit new money: ${round.newMoney} / ${pricePerShare.toFixed(6)} = ${shares.toString()} shares`);
    }
    stages.push(snapshot(state, "NEW_MONEY", "After new money issuance"));
  };

  // Sequence by ordering rule
  const rule = round.conversionOrderingRule;
  if (rule === "POOL_TOPUP_THEN_CONVERTIBLES_THEN_NEW_MONEY") {
    doPoolTopUp();
    doConvertibles();
    doNewMoney();
  } else if (rule === "NOTES_THEN_SAFES_THEN_NEW_MONEY" || rule === "SAFES_THEN_NOTES_THEN_NEW_MONEY") {
    doConvertibles();
    doPoolTopUp();
    doNewMoney();
  } else {
    // CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY (default) and CUSTOM_SIMPLIFIED
    doConvertibles();
    doPoolTopUp();
    doNewMoney();
  }

  // Final warnings
  const finalFD = currentFD(state);
  const authorizedTotal =
    (input.authorizedCommonShares ? BigInt(input.authorizedCommonShares) : 0n) +
    (input.authorizedPreferredShares ? BigInt(input.authorizedPreferredShares) : 0n);
  if (authorizedTotal > 0n && finalFD > authorizedTotal) {
    warnings.push({
      code: "AUTHORIZED_EXCEEDED",
      severity: "critical",
      message: `Post-scenario FD of ${finalFD.toString()} exceeds authorized shares ${authorizedTotal.toString()}`,
    });
  }

  warnings.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return order[a.severity] - order[b.severity];
  });

  const finalOwnership = ownershipFromState(state);

  return {
    inputs: input,
    intermediates: {
      pricePerShare,
      pricePerShareMethod: ppsResult.method,
      preMoneyDenominatorShares: preMoneyDenom,
      capDenominatorShares: capDenom,
      baselineFullyDiluted: baselineFD.fullyDiluted,
      poolTopUpShares,
      poolTopUpMethod,
      newInvestorShares: newMoneyShares,
    },
    stages,
    finalOwnership,
    convertibleDetails: details,
    warnings,
    formulaTrace,
  };
}
