import fs from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { runScenario } from "../../src/lib/scenario-engine/orchestrator";
import type { ScenarioInput } from "../../src/lib/scenario-engine/types";

interface GoldenFile {
  description: string;
  derivation: string;
  input: unknown;
  expected: {
    pricePerShare?: string;
    safeSharesBySafeId?: Record<string, string>;
    safeSelectedMethodBySafeId?: Record<string, string>;
    noteSharesByNoteId?: Record<string, string>;
    noteAccruedInterest?: Record<string, string>;
    acceleratorSharesIssued?: string;
    acceleratorPercent?: string;
    newInvestorShares?: string;
    finalFullyDiluted: string;
    warningCodes?: string[];
  };
}

/**
 * Convert the shareCount/optionCount/etc. fields from string → bigint so the
 * JSON-serialized fixture can be fed into the engine unchanged otherwise.
 */
function hydrate(raw: unknown): ScenarioInput {
  const str = JSON.stringify(raw);
  return JSON.parse(str, (key, value) => {
    const bigIntFields = new Set([
      "shareCount",
      "optionCount",
      "exercisedCount",
      "cancelledCount",
    ]);
    if (bigIntFields.has(key) && typeof value === "string") {
      return BigInt(value);
    }
    return value;
  }) as ScenarioInput;
}

const fixturesDir = path.join(__dirname);
const fixtures = fs
  .readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("golden file tests", () => {
  for (const filename of fixtures) {
    const full = path.join(fixturesDir, filename);
    const file = JSON.parse(fs.readFileSync(full, "utf8")) as GoldenFile;

    it(`${filename}: ${file.description}`, () => {
      const input = hydrate(file.input);
      const result = runScenario(input);
      const exp = file.expected;

      if (exp.pricePerShare != null) {
        expect(result.intermediates.pricePerShare).not.toBeNull();
        expect(result.intermediates.pricePerShare!.toFixed(6)).toBe(
          new Decimal(exp.pricePerShare).toFixed(6),
        );
      }

      if (exp.safeSharesBySafeId) {
        for (const [id, expectedShares] of Object.entries(exp.safeSharesBySafeId)) {
          const d = result.convertibleDetails.find((x) => x.instrumentId === id);
          expect(d).toBeDefined();
          expect(d!.sharesIssued.toString()).toBe(expectedShares);
        }
      }

      if (exp.safeSelectedMethodBySafeId) {
        for (const [id, expectedMethod] of Object.entries(exp.safeSelectedMethodBySafeId)) {
          const d = result.convertibleDetails.find((x) => x.instrumentId === id);
          expect(d).toBeDefined();
          expect(d!.selectedMethod).toBe(expectedMethod);
        }
      }

      if (exp.noteSharesByNoteId) {
        for (const [id, expectedShares] of Object.entries(exp.noteSharesByNoteId)) {
          const d = result.convertibleDetails.find((x) => x.instrumentId === id);
          expect(d).toBeDefined();
          expect(d!.sharesIssued.toString()).toBe(expectedShares);
        }
      }

      if (exp.noteAccruedInterest) {
        for (const [id, expectedInterest] of Object.entries(exp.noteAccruedInterest)) {
          const d = result.convertibleDetails.find((x) => x.instrumentId === id);
          expect(d).toBeDefined();
          const diff = d!.accruedInterest.minus(expectedInterest).abs();
          expect(diff.lte("0.02")).toBe(true);
        }
      }

      if (exp.acceleratorSharesIssued != null) {
        const totalAccel = Array.from(result.finalOwnership)
          .filter((row) => row.group === "new_money")
          .reduce((acc, row) => acc + row.shareCount, 0n);
        expect(totalAccel.toString()).toBe(exp.acceleratorSharesIssued);
      }

      if (exp.acceleratorPercent != null) {
        const row = result.finalOwnership.find((r) => r.group === "new_money");
        expect(row).toBeDefined();
        expect(row!.percentOfFD.toFixed(2)).toBe(exp.acceleratorPercent);
      }

      if (exp.newInvestorShares != null) {
        expect(result.intermediates.newInvestorShares.toString()).toBe(
          exp.newInvestorShares,
        );
      }

      const finalFD = result.stages[result.stages.length - 1].fullyDiluted;
      expect(finalFD.toString()).toBe(exp.finalFullyDiluted);

      if (exp.warningCodes) {
        for (const code of exp.warningCodes) {
          expect(result.warnings.some((w) => w.code === code)).toBe(true);
        }
      }

      // Ownership sums to 100% within epsilon
      const total = result.finalOwnership.reduce(
        (acc, row) => acc.add(row.percentOfFD),
        new Decimal(0),
      );
      expect(total.minus(100).abs().lte(new Decimal("0.01"))).toBe(true);
    });
  }
});
