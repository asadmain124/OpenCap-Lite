import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";

export default async function SafesPage() {
  const companyId = await getPrimaryCompanyId();
  const rows = companyId
    ? await prisma.sAFEInstrument.findMany({
        where: { companyId },
        orderBy: { issueDate: "desc" },
        include: { stakeholder: true },
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SAFEs</h1>
        <p className="text-sm text-muted-foreground">Simple Agreements for Future Equity — convert at the next priced round.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} SAFEs</CardTitle>
          <CardDescription>
            Outstanding: {rows.filter((r) => r.status === "OUTSTANDING").length} ·
            {" "}
            Converted: {rows.filter((r) => r.status === "CONVERTED").length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Holder</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-right">Valuation Cap</th>
                  <th className="p-2 text-right">Discount</th>
                  <th className="p-2 text-left">Post-Money</th>
                  <th className="p-2 text-left">MFN</th>
                  <th className="p-2 text-left">Issue Date</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2">{r.stakeholder.name}</td>
                    <td className="p-2 text-right tabular-nums">
                      {formatCurrency(r.purchaseAmount.toString())}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.valuationCap ? formatCurrency(r.valuationCap.toString()) : "—"}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.discountPercent ? formatPercent(Number(r.discountPercent) / 100, "en-US", 1) : "—"}
                    </td>
                    <td className="p-2">{r.postMoney ? "Yes" : "No"}</td>
                    <td className="p-2">{r.mfn ? <Badge>MFN</Badge> : "—"}</td>
                    <td className="p-2">{formatDate(r.issueDate)}</td>
                    <td className="p-2">{r.status}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      No SAFEs yet
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
