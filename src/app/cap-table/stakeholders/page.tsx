import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Badge } from "@/components/ui/badge";
import { StakeholderTable } from "./StakeholderTable";

export default async function StakeholdersPage() {
  const companyId = await getPrimaryCompanyId();
  const rows = companyId
    ? await prisma.stakeholder.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
      })
    : [];

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
      <StakeholderTable
        companyId={companyId}
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
