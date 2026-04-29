import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Badge } from "@/components/ui/badge";
import { EmptyStateLearn } from "@/components/help/EmptyStateLearn";
import { SecurityClassTable } from "./SecurityClassTable";

export default async function SecurityClassesPage() {
  const companyId = await getPrimaryCompanyId();
  const rows = companyId
    ? await prisma.securityClass.findMany({
        where: { companyId },
        orderBy: [{ seniorityOrder: "asc" }, { name: "asc" }],
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Security classes
        </h1>
        <p className="text-sm text-muted-foreground">
          <Badge variant="secondary">{rows.length}</Badge> defined — common,
          preferred, option pools, warrants.
        </p>
      </div>
      {rows.length === 0 && <EmptyStateLearn entity="security_class" />}
      <SecurityClassTable
        companyId={companyId}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          seniorityOrder: r.seniorityOrder,
          authorizedShares: r.authorizedShares?.toString() ?? null,
          reservedUngrantedShares:
            r.reservedUngrantedShares?.toString() ?? null,
          liquidationPreferenceMultiple:
            r.liquidationPreferenceMultiple?.toString() ?? null,
          participationRights: r.participationRights,
        }))}
      />
    </div>
  );
}
