import Decimal from "decimal.js";

export type Numericish = number | string | bigint | Decimal;

function toDecimal(value: Numericish): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "bigint") return new Decimal(value.toString());
  return new Decimal(value);
}

export function formatCurrency(
  value: Numericish,
  currency = "USD",
  locale = "en-US",
  maximumFractionDigits = 2,
): string {
  const n = toDecimal(value).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(n);
}

export function formatNumber(
  value: Numericish,
  locale = "en-US",
  maximumFractionDigits = 0,
): string {
  const n = toDecimal(value).toNumber();
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(n);
}

export function formatPercent(
  value: Numericish,
  locale = "en-US",
  maximumFractionDigits = 2,
): string {
  const n = toDecimal(value).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits,
  }).format(n);
}

export function formatShares(value: Numericish): string {
  return formatNumber(value, "en-US", 0);
}

/**
 * Parse a user-entered percent string that might include a trailing % or
 * extra whitespace. Accepts "10", "10%", "10.5%".
 */
export function parsePercent(input: string): number {
  const trimmed = input.replace(/%/g, "").replace(/\s/g, "");
  const n = Number(trimmed);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid percent input: ${input}`);
  }
  return n;
}

/**
 * Parse a user-entered currency string ("$1,000,000" -> 1000000).
 */
export function parseCurrency(input: string): number {
  const trimmed = input.replace(/[$,\s]/g, "");
  const n = Number(trimmed);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid currency input: ${input}`);
  }
  return n;
}

export function formatDate(value: Date | string, locale = "en-US"): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}
