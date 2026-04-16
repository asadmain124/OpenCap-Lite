import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";

export default async function NotesPage() {
  const companyId = await getPrimaryCompanyId();
  const rows = companyId
    ? await prisma.convertibleNote.findMany({
        where: { companyId },
        orderBy: { issueDate: "desc" },
        include: { stakeholder: true },
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Convertible Notes</h1>
        <p className="text-sm text-muted-foreground">Debt instruments that convert at a discount or cap at the next priced round.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} notes</CardTitle>
          <CardDescription>
            Outstanding: {rows.filter((r) => r.status === "OUTSTANDING").length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Holder</th>
                  <th className="p-2 text-right">Principal</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-left">Accrual</th>
                  <th className="p-2 text-right">Cap</th>
                  <th className="p-2 text-right">Discount</th>
                  <th className="p-2 text-left">Issue Date</th>
                  <th className="p-2 text-left">Maturity</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2">{r.stakeholder.name}</td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(r.principal.toString())}</td>
                    <td className="p-2 text-right tabular-nums">
                      {formatPercent(Number(r.annualInterestRatePercent) / 100, "en-US", 2)}
                    </td>
                    <td className="p-2">
                      {r.interestType}
                      {r.interestType === "COMPOUND" && r.compoundingFrequencyPerYear
                        ? ` (${r.compoundingFrequencyPerYear}/yr)`
                        : ""}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.valuationCap ? formatCurrency(r.valuationCap.toString()) : "—"}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.discountPercent ? formatPercent(Number(r.discountPercent) / 100, "en-US", 1) : "—"}
                    </td>
                    <td className="p-2">{formatDate(r.issueDate)}</td>
                    <td className="p-2">{r.maturityDate ? formatDate(r.maturityDate) : "—"}</td>
                    <td className="p-2">{r.status}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-muted-foreground">
                      No notes yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
