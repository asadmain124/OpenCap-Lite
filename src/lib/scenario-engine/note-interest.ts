import Decimal from "decimal.js";

/**
 * PRD §9.2 — Convertible note accrued interest.
 *
 * Simple:   accrued = principal × rate × (daysElapsed / daysInYear)
 * Compound: accrued = principal × ((1 + rate/freq)^periods − 1)
 *           where periods = daysElapsed × freq / daysInYear
 *
 * Day-count conventions:
 * - ACT_365 (default): actual calendar days, 365-day year
 * - ACT_360: actual calendar days, 360-day year (common for USD commercial paper)
 * - 30_360: 30-day months, 360-day year (European "Bond Basis" / 30E/360)
 */

export type DayCountConvention = "ACT_365" | "ACT_360" | "30_360";

export interface NoteInterestInput {
  principal: Decimal | string;
  annualInterestRatePercent: Decimal | string;
  interestType: "SIMPLE" | "COMPOUND";
  compoundingFrequencyPerYear: number | null;
  issueDate: Date;
  accrualCutoffDate: Date;
  dayCountConvention?: DayCountConvention;
}

export interface NoteInterestResult {
  accruedInterest: Decimal;
  totalConversionAmount: Decimal;
  daysElapsed: number;
  method: string;
}

const MS_PER_DAY = 86_400_000;

function actualDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / MS_PER_DAY));
}

// European 30E/360 bond-basis day count: both dates clamped to 30.
function days30_360(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  const y1 = from.getUTCFullYear();
  const m1 = from.getUTCMonth() + 1;
  const d1 = Math.min(30, from.getUTCDate());
  const y2 = to.getUTCFullYear();
  const m2 = to.getUTCMonth() + 1;
  const d2 = Math.min(30, to.getUTCDate());
  return 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
}

export function computeDaysElapsed(
  from: Date,
  to: Date,
  convention: DayCountConvention,
): { days: number; yearBasis: number } {
  if (convention === "30_360") {
    return { days: days30_360(from, to), yearBasis: 360 };
  }
  if (convention === "ACT_360") {
    return { days: actualDays(from, to), yearBasis: 360 };
  }
  return { days: actualDays(from, to), yearBasis: 365 };
}

export function computeAccruedInterest(input: NoteInterestInput): NoteInterestResult {
  const principal = new Decimal(input.principal);
  const ratePercent = new Decimal(input.annualInterestRatePercent);
  const rate = ratePercent.div(100);

  const convention = input.dayCountConvention ?? "ACT_365";
  const { days: daysElapsed, yearBasis } = computeDaysElapsed(
    input.issueDate,
    input.accrualCutoffDate,
    convention,
  );

  if (input.interestType === "SIMPLE") {
    const accrued = principal.mul(rate).mul(new Decimal(daysElapsed).div(yearBasis));
    return {
      accruedInterest: accrued,
      totalConversionAmount: principal.add(accrued),
      daysElapsed,
      method: `simple ${convention}: principal × rate × daysElapsed/${yearBasis}`,
    };
  }

  // COMPOUND
  if (input.compoundingFrequencyPerYear == null) {
    throw new Error("Compound interest requires compoundingFrequencyPerYear");
  }
  const freq = new Decimal(input.compoundingFrequencyPerYear);
  const periods = new Decimal(daysElapsed).mul(freq).div(yearBasis);
  const ratePerPeriod = rate.div(freq);
  const growth = Decimal.pow(new Decimal(1).add(ratePerPeriod), periods);
  const accrued = principal.mul(growth.sub(1));
  return {
    accruedInterest: accrued,
    totalConversionAmount: principal.add(accrued),
    daysElapsed,
    method: `compound ${convention}: principal × ((1 + rate/${input.compoundingFrequencyPerYear})^periods − 1)`,
  };
}
