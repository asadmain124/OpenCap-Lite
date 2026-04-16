import { describe, expect, it } from "vitest";
import { computeFullyDiluted } from "./fully-diluted";

describe("computeFullyDiluted", () => {
  const baseHoldings = [
    { shareCount: 8_000_000n, status: "ACTIVE" as const },
    { shareCount: 8_000_000n, status: "ACTIVE" as const },
    { shareCount: 1_000n, status: "CANCELLED" as const },
  ];
  const baseGrants = [
    { optionCount: 100_000n, cancelledCount: 0n, status: "ACTIVE" as const },
    { optionCount: 25_000n, cancelledCount: 5_000n, status: "ACTIVE" as const },
    { optionCount: 10_000n, cancelledCount: 0n, status: "EXPIRED" as const },
  ];

  it("default settings: ACTIVE only, include options, include reserved", () => {
    const r = computeFullyDiluted({
      holdings: baseHoldings,
      optionGrants: baseGrants,
      reservedUngrantedPool: 2_000_000n,
      settings: {
        includeAllGrantedOptions: true,
        includeCancelledGrants: false,
        includeReservedUngranted: true,
      },
    });
    expect(r.breakdown.common).toBe(16_000_000n);
    expect(r.breakdown.options).toBe(100_000n + (25_000n - 5_000n));
    expect(r.breakdown.reserved).toBe(2_000_000n);
    expect(r.fullyDiluted).toBe(18_120_000n);
  });

  it("includeCancelledGrants pulls in EXPIRED grants", () => {
    const r = computeFullyDiluted({
      holdings: baseHoldings,
      optionGrants: baseGrants,
      reservedUngrantedPool: 2_000_000n,
      settings: {
        includeAllGrantedOptions: true,
        includeCancelledGrants: true,
        includeReservedUngranted: true,
      },
    });
    expect(r.breakdown.options).toBe(100_000n + 20_000n + 10_000n);
  });

  it("turning off reserved pool removes it from FD", () => {
    const r = computeFullyDiluted({
      holdings: baseHoldings,
      optionGrants: baseGrants,
      reservedUngrantedPool: 2_000_000n,
      settings: {
        includeAllGrantedOptions: true,
        includeCancelledGrants: false,
        includeReservedUngranted: false,
      },
    });
    expect(r.breakdown.reserved).toBe(0n);
    expect(r.fullyDiluted).toBe(16_120_000n);
  });

  it("turning off all options zeroes the options bucket", () => {
    const r = computeFullyDiluted({
      holdings: baseHoldings,
      optionGrants: baseGrants,
      reservedUngrantedPool: 0n,
      settings: {
        includeAllGrantedOptions: false,
        includeCancelledGrants: false,
        includeReservedUngranted: false,
      },
    });
    expect(r.breakdown.options).toBe(0n);
    expect(r.fullyDiluted).toBe(16_000_000n);
  });
});
