import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShares, formatCurrency, formatDate } from "@/lib/formatters";

export default async function HoldingsPage() {
  const companyId = await getPrimaryCompanyId();
  const rows = companyId
    ? await prisma.equityHolding.findMany({
        where: { companyId },
        orderBy: { issueDate: "desc" },
        include: { stakeholder: true, securityClass: true },
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equity Holdings</h1>
        <p className="text-sm text-muted-foreground">Issued stock certificates held by stakeholders.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} holdings</CardTitle>
          <CardDescription>Export via Settings → CSV or OCF.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Stakeholder</th>
                  <th className="p-2 text-left">Security Class</th>
                  <th className="p-2 text-right">Shares</th>
                  <th className="p-2 text-right">$/Share</th>
                  <th className="p-2 text-left">Issue Date</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2">{r.stakeholder.name}</td>
                    <td className="p-2">{r.securityClass.name}</td>
                    <td className="p-2 text-right tabular-nums">{formatShares(r.shareCount)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {r.pricePaidPerShare ? formatCurrency(r.pricePaidPerShare.toString(), "USD", "en-US", 4) : "—"}
                    </td>
                    <td className="p-2">{formatDate(r.issueDate)}</td>
                    <td className="p-2">{r.status}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No holdings yet
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
