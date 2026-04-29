import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Badge } from "@/components/ui/badge";
import { EmptyStateLearn } from "@/components/help/EmptyStateLearn";
import { computeFullyDiluted } from "@/lib/scenario-engine/fully-diluted";
import { SafeTable } from "./SafeTable";

export default async function SafesPage() {
  const companyId = await getPrimaryCompanyId();
  const [rows, stakeholders, holdings, grants, classes] = companyId
    ? await Promise.all([
        prisma.sAFEInstrument.findMany({
          where: { companyId },
          orderBy: { issueDate: "desc" },
          include: { stakeholder: true },
        }),
        prisma.stakeholder.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.equityHolding.findMany({
          where: { companyId },
          select: { shareCount: true, status: true },
        }),
        prisma.optionGrant.findMany({
          where: { companyId },
          select: {
            optionCount: true,
            cancelledCount: true,
            status: true,
          },
        }),
        prisma.securityClass.findMany({
          where: { companyId },
          select: { type: true, reservedUngrantedShares: true },
        }),
      ])
    : [[], [], [], [], []];

  const reservedPool = classes
    .filter((s) => s.type === "OPTION_POOL")
    .reduce((acc, s) => acc + (s.reservedUngrantedShares ?? 0n), 0n);
  const fd = computeFullyDiluted({
    holdings,
    optionGrants: grants,
    reservedUngrantedPool: reservedPool,
    settings: {
      includeAllGrantedOptions: true,
      includeCancelledGrants: false,
      includeReservedUngranted: true,
    },
  });

  const outstanding = rows.filter((r) => r.status === "OUTSTANDING").length;
  const converted = rows.filter((r) => r.status === "CONVERTED").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SAFEs</h1>
        <p className="text-sm text-muted-foreground">
          <Badge variant="secondary">{outstanding}</Badge> outstanding ·{" "}
          <Badge variant="outline">{converted}</Badge> converted
        </p>
      </div>
      {rows.length === 0 && <EmptyStateLearn entity="safe" />}
      <SafeTable
        companyId={companyId}
        baselineFD={fd.fullyDiluted.toString()}
        rows={rows.map((r) => ({
          id: r.id,
          stakeholderId: r.stakeholderId,
          stakeholderName: r.stakeholder.name,
          issueDate: r.issueDate.toISOString(),
          purchaseAmount: r.purchaseAmount.toString(),
          valuationCap: r.valuationCap?.toString() ?? null,
          discountPercent: r.discountPercent?.toString() ?? null,
          mfn: r.mfn,
          postMoney: r.postMoney,
          proRataRights: r.proRataRights,
          status: r.status,
        }))}
        stakeholders={stakeholders}
      />
    </div>
  );
}
