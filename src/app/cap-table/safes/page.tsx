import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Badge } from "@/components/ui/badge";
import { SafeTable } from "./SafeTable";

export default async function SafesPage() {
  const companyId = await getPrimaryCompanyId();
  const [rows, stakeholders] = companyId
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
      ])
    : [[], []];

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
      <SafeTable
        companyId={companyId}
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
