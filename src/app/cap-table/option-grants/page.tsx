import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Badge } from "@/components/ui/badge";
import { EmptyStateLearn } from "@/components/help/EmptyStateLearn";
import { OptionGrantTable } from "./OptionGrantTable";

export default async function OptionGrantsPage() {
  const companyId = await getPrimaryCompanyId();
  const [rows, stakeholders] = companyId
    ? await Promise.all([
        prisma.optionGrant.findMany({
          where: { companyId },
          orderBy: { grantDate: "desc" },
          include: { stakeholder: true },
        }),
        prisma.stakeholder.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  const active = rows.filter((r) => r.status === "ACTIVE").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Option grants</h1>
        <p className="text-sm text-muted-foreground">
          <Badge variant="secondary">{active}</Badge> active ·{" "}
          {rows.length - active} inactive
        </p>
      </div>
      {rows.length === 0 && <EmptyStateLearn entity="option_grant" />}
      <OptionGrantTable
        companyId={companyId}
        rows={rows.map((r) => ({
          id: r.id,
          stakeholderId: r.stakeholderId,
          stakeholderName: r.stakeholder.name,
          optionCount: r.optionCount.toString(),
          exercisedCount: r.exercisedCount.toString(),
          cancelledCount: r.cancelledCount.toString(),
          strikePrice: r.strikePrice.toString(),
          grantDate: r.grantDate.toISOString(),
          expirationDate: r.expirationDate?.toISOString() ?? null,
          status: r.status,
          vestingStartDate: r.vestingStartDate?.toISOString() ?? null,
          vestingCliffMonths: r.vestingCliffMonths,
          vestingDurationMonths: r.vestingDurationMonths,
          vestingFrequency: r.vestingFrequency,
        }))}
        stakeholders={stakeholders}
      />
    </div>
  );
}
