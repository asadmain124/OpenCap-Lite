import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Badge } from "@/components/ui/badge";
import { EmptyStateLearn } from "@/components/help/EmptyStateLearn";
import { StakeholderTable } from "./StakeholderTable";

export default async function StakeholdersPage() {
  const companyId = await getPrimaryCompanyId();
  const [rows, securityClasses] = companyId
    ? await Promise.all([
        prisma.stakeholder.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
        }),
        prisma.securityClass.findMany({
          where: { companyId },
          orderBy: { seniorityOrder: "asc" },
          select: { id: true, name: true, type: true },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stakeholders</h1>
          <p className="text-sm text-muted-foreground">
            <Badge variant="secondary">{rows.length}</Badge> total
          </p>
        </div>
      </div>
      {rows.length === 0 && <EmptyStateLearn entity="stakeholder" />}
      <StakeholderTable
        companyId={companyId}
        securityClasses={securityClasses}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          email: r.email,
          notes: r.notes,
        }))}
      />
    </div>
  );
}
