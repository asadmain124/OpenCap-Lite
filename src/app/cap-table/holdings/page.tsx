import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Badge } from "@/components/ui/badge";
import { HoldingTable } from "./HoldingTable";

export default async function HoldingsPage() {
  const companyId = await getPrimaryCompanyId();
  const [rows, stakeholders, securityClasses] = companyId
    ? await Promise.all([
        prisma.equityHolding.findMany({
          where: { companyId },
          orderBy: { issueDate: "desc" },
          include: { stakeholder: true, securityClass: true },
        }),
        prisma.stakeholder.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.securityClass.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Equity holdings
        </h1>
        <p className="text-sm text-muted-foreground">
          <Badge variant="secondary">{rows.length}</Badge> issued stock
          certificates held by stakeholders.
        </p>
      </div>
      <HoldingTable
        companyId={companyId}
        rows={rows.map((r) => ({
          id: r.id,
          stakeholderId: r.stakeholderId,
          stakeholderName: r.stakeholder.name,
          securityClassId: r.securityClassId,
          securityClassName: r.securityClass.name,
          shareCount: r.shareCount.toString(),
          pricePaidPerShare: r.pricePaidPerShare?.toString() ?? null,
          issueDate: r.issueDate.toISOString(),
          status: r.status,
          certificateNumber: r.certificateNumber,
          notes: r.notes,
        }))}
        stakeholders={stakeholders}
        securityClasses={securityClasses}
      />
    </div>
  );
}
