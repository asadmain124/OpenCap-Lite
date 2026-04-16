import { NextRequest } from "next/server";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { computeFullyDiluted } from "@/lib/scenario-engine/fully-diluted";
import { ok, toApiError } from "@/lib/api/response";

/**
 * Aggregate summary for the dashboard. Pure read, uses engine for FD.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        stakeholders: { select: { id: true } },
        securityClasses: true,
        holdings: true,
        optionGrants: true,
        safes: true,
        notes: true,
        scenarios: { select: { id: true } },
      },
    });

    let commonShares = 0n;
    let preferredShares = 0n;
    const securityTypeById = new Map<string, string>();
    for (const sc of company.securityClasses) {
      securityTypeById.set(sc.id, sc.type);
    }
    for (const h of company.holdings) {
      if (h.status !== "ACTIVE") continue;
      const t = securityTypeById.get(h.securityClassId);
      if (t === "PREFERRED") preferredShares += h.shareCount;
      else commonShares += h.shareCount;
    }

    let optionsGranted = 0n;
    let optionsExercised = 0n;
    for (const g of company.optionGrants) {
      if (g.status === "ACTIVE") {
        optionsGranted += g.optionCount - g.cancelledCount;
        optionsExercised += g.exercisedCount;
      }
    }

    const reservedPool = company.securityClasses
      .filter((sc) => sc.type === "OPTION_POOL")
      .reduce((acc, sc) => acc + (sc.reservedUngrantedShares ?? 0n), 0n);

    const fd = computeFullyDiluted({
      holdings: company.holdings.map((h) => ({ shareCount: h.shareCount, status: h.status })),
      optionGrants: company.optionGrants.map((g) => ({
        optionCount: g.optionCount,
        cancelledCount: g.cancelledCount,
        status: g.status,
      })),
      reservedUngrantedPool: reservedPool,
      settings: {
        includeAllGrantedOptions: true,
        includeCancelledGrants: false,
        includeReservedUngranted: true,
      },
    });

    const safeTotal = company.safes
      .filter((s) => s.status === "OUTSTANDING")
      .reduce((acc, s) => acc.plus(s.purchaseAmount.toString()), new Decimal(0));
    const noteTotal = company.notes
      .filter((n) => n.status === "OUTSTANDING")
      .reduce((acc, n) => acc.plus(n.principal.toString()), new Decimal(0));

    return ok({
      companyId: company.id,
      companyName: company.legalName,
      commonShares,
      preferredShares,
      optionsGranted,
      optionsExercised,
      safeCount: company.safes.filter((s) => s.status === "OUTSTANDING").length,
      safeTotal: safeTotal.toString(),
      noteCount: company.notes.filter((n) => n.status === "OUTSTANDING").length,
      noteTotal: noteTotal.toString(),
      fullyDiluted: fd.fullyDiluted,
      fullyDilutedBreakdown: fd.breakdown,
      authorizedCommonShares: company.authorizedCommonShares,
      authorizedPreferredShares: company.authorizedPreferredShares,
      stakeholderCount: company.stakeholders.length,
      scenarioCount: company.scenarios.length,
      reservedUngrantedPool: reservedPool,
    });
  } catch (e) {
    return toApiError(e);
  }
}
