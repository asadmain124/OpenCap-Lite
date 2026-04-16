import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a BigInt value to a plain number for UI display only.
 * Throws if the number would overflow Number.MAX_SAFE_INTEGER.
 */
export function bigIntToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`BigInt ${value} exceeds safe number range`);
  }
  return Number(value);
}

/**
 * Deeply serialize an object replacing BigInt values with strings so that
 * JSON.stringify works and UI code can re-hydrate as needed.
 */
export function serializeBigInts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}
