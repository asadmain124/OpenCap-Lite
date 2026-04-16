import Decimal from "decimal.js";

/**
 * PRD §9.2 — Convertible note accrued interest.
 *
 * Simple:   accrued = principal × rate × (daysElapsed / 365)
 * Compound: accrued = principal × ((1 + rate/freq)^periods − 1)
 *           where periods = daysElapsed × freq / 365
 *
 * Returns total conversion amount = principal + accrued.
 * Uses decimal.js — no JS Number for money.
 */

export interface NoteInterestInput {
  principal: Decimal | string;
  annualInterestRatePercent: Decimal | string;
  interestType: "SIMPLE" | "COMPOUND";
  compoundingFrequencyPerYear: number | null;
  issueDate: Date;
  accrualCutoffDate: Date;
}

export interface NoteInterestResult {
  accruedInterest: Decimal;
  totalConversionAmount: Decimal;
  daysElapsed: number;
  method: string;
}

const MS_PER_DAY = 86_400_000;

export function computeAccruedInterest(input: NoteInterestInput): NoteInterestResult {
  const principal = new Decimal(input.principal);
  const ratePercent = new Decimal(input.annualInterestRatePercent);
  const rate = ratePercent.div(100);

  const ms = input.accrualCutoffDate.getTime() - input.issueDate.getTime();
  const rawDays = Math.max(0, Math.floor(ms / MS_PER_DAY));
  const daysElapsed = rawDays;

  if (input.interestType === "SIMPLE") {
    const accrued = principal.mul(rate).mul(new Decimal(daysElapsed).div(365));
    return {
      accruedInterest: accrued,
      totalConversionAmount: principal.add(accrued),
      daysElapsed,
      method: "simple: principal × rate × daysElapsed/365",
    };
  }

  // COMPOUND
  if (input.compoundingFrequencyPerYear == null) {
    throw new Error("Compound interest requires compoundingFrequencyPerYear");
  }
  const freq = new Decimal(input.compoundingFrequencyPerYear);
  const periods = new Decimal(daysElapsed).mul(freq).div(365);
  const ratePerPeriod = rate.div(freq);
  // (1 + rate/freq) ^ periods
  const growth = Decimal.pow(new Decimal(1).add(ratePerPeriod), periods);
  const accrued = principal.mul(growth.sub(1));
  return {
    accruedInterest: accrued,
    totalConversionAmount: principal.add(accrued),
    daysElapsed,
    method: `compound: principal × ((1 + rate/${input.compoundingFrequencyPerYear})^periods − 1)`,
  };
}
