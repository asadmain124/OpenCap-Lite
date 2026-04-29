import * as React from "react";
import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { SerializedScenarioResult } from "./ScenarioResults";

/**
 * Pure synthesizer over the structured fields of SerializedScenarioResult.
 * Returns 0+ short plain-English insights. Caller decides how to render.
 */
export function buildNarrative(result: SerializedScenarioResult): string[] {
  const out: string[] = [];

  const baselineStage = result.stages[0];
  const finalRows = result.finalOwnership;
  const finalFD = Number(
    result.stages[result.stages.length - 1]?.fullyDiluted ?? "0",
  );
  const pps = result.intermediates.pricePerShare
    ? Number(result.intermediates.pricePerShare)
    : null;
  const newInvestorShares = Number(
    result.intermediates.newInvestorShares ?? "0",
  );
  const poolTopUpShares = Number(result.intermediates.poolTopUpShares ?? "0");

  // 1. Founders / common shareholders dilution
  if (baselineStage) {
    const baselineCommonPct = sumPct(baselineStage.ownership, "common");
    const finalCommonPct = sumPct(finalRows, "common");
    if (baselineCommonPct > 0) {
      const delta = finalCommonPct - baselineCommonPct;
      const verb = delta < 0 ? "drops to" : "rises to";
      out.push(
        `Existing common holders go from ${pct1(baselineCommonPct)} to ${pct1(finalCommonPct)} (${signedPp(delta)}).`,
      );
      if (delta < 0) {
        out.push(
          dilutionPlainEnglish(baselineCommonPct, finalCommonPct, verb),
        );
      }
    }
  }

  // 2. Lead investor (largest new_money row)
  const leadInvestor = finalRows
    .filter((r) => r.group === "new_money")
    .sort(
      (a, b) =>
        Number(b.fullyDilutedShares) - Number(a.fullyDilutedShares),
    )[0];
  if (leadInvestor && pps != null) {
    const investorShares = Number(leadInvestor.shareCount);
    const investorPct = Number(leadInvestor.percentOfFD);
    const investorDollars = investorShares * pps;
    out.push(
      `${leadInvestor.stakeholderName} receives ${pct1(investorPct)} for ${formatCurrency(investorDollars)} at ${formatCurrency(pps, "USD", "en-US", 4)}/share.`,
    );
  }

  // 3. Pool top-up
  if (poolTopUpShares > 0 && finalFD > 0) {
    const poolPct = (poolTopUpShares / finalFD) * 100;
    out.push(
      `An option pool top-up of ${integer(poolTopUpShares)} shares (${pct1(poolPct)} of post-money) dilutes existing holders.`,
    );
  }

  // 4. SAFE / note conversions
  const conversions = result.convertibleDetails;
  if (conversions.length > 0) {
    const totalConverted = conversions.reduce(
      (acc, c) => acc + Number(c.totalConversionAmount),
      0,
    );
    const safeCount = conversions.filter(
      (c) => c.instrumentType === "SAFE",
    ).length;
    const noteCount = conversions.filter(
      (c) => c.instrumentType === "NOTE",
    ).length;
    const methods = conversions.map((c) => c.selectedMethod);
    const dominant = methods[0] ?? "";
    const allSame = methods.every((m) => m === dominant);
    const methodPhrase = allSame
      ? methodLabel(dominant)
      : "a mix of cap and discount";
    const parts: string[] = [];
    if (safeCount > 0) parts.push(`${safeCount} SAFE${safeCount === 1 ? "" : "s"}`);
    if (noteCount > 0) parts.push(`${noteCount} note${noteCount === 1 ? "" : "s"}`);
    out.push(
      `${parts.join(" and ")} totalling ${formatCurrency(totalConverted)} convert via ${methodPhrase}.`,
    );
  }

  // 5. Post-money valuation
  if (pps != null && finalFD > 0) {
    out.push(
      `Post-money valuation: ${formatCurrency(pps * finalFD)}.`,
    );
  }

  return out;
}

export function ResultNarrative({
  result,
}: {
  result: SerializedScenarioResult;
}) {
  const insights = buildNarrative(result);
  if (insights.length === 0) return null;

  return (
    <Card className="border-primary/40 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">In plain English</CardTitle>
        </div>
        <CardDescription>What this scenario actually does</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {insights.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---- helpers ----

type OwnershipLike = {
  group: string;
  percentOfFD: string;
};

function sumPct(rows: OwnershipLike[], group: string): number {
  return rows
    .filter((r) => r.group === group)
    .reduce((acc, r) => acc + Number(r.percentOfFD), 0);
}

function pct1(n: number): string {
  return `${n.toFixed(1)}%`;
}

function signedPp(delta: number): string {
  const sign = delta >= 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toFixed(1)} pp`;
}

function integer(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function methodLabel(m: string): string {
  switch (m) {
    case "CAP":
      return "the valuation cap";
    case "DISCOUNT":
      return "the discount";
    case "UNRESOLVED_MFN":
      return "MFN (unresolved — needs an explicit cap or discount)";
    default:
      return m.toLowerCase();
  }
}

function dilutionPlainEnglish(
  before: number,
  after: number,
  _verb: string,
): string {
  const ratio = after / before;
  if (ratio < 0.7) {
    return "That's a significant dilution — typical for a major round, but worth pressure-testing the option pool size.";
  }
  if (ratio < 0.9) {
    return "Standard dilution for a priced round of this size.";
  }
  return "Light dilution — small relative round size or no pool top-up.";
}
