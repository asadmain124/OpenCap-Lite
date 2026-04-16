import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShares, formatCurrency, formatDate } from "@/lib/formatters";

export default async function OptionGrantsPage() {
  const companyId = await getPrimaryCompanyId();
  const rows = companyId
    ? await prisma.optionGrant.findMany({
        where: { companyId },
        orderBy: { grantDate: "desc" },
        include: { stakeholder: true },
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Option Grants</h1>
        <p className="text-sm text-muted-foreground">Equity compensation issued to employees, advisors, and consultants.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} grants</CardTitle>
          <CardDescription>Vesting schedules, strike prices, and exercise status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Grantee</th>
                  <th className="p-2 text-right">Granted</th>
                  <th className="p-2 text-right">Exercised</th>
                  <th className="p-2 text-right">Cancelled</th>
                  <th className="p-2 text-right">Strike</th>
                  <th className="p-2 text-left">Grant Date</th>
                  <th className="p-2 text-left">Vesting</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2">{r.stakeholder.name}</td>
                    <td className="p-2 text-right tabular-nums">{formatShares(r.optionCount)}</td>
                    <td className="p-2 text-right tabular-nums">{formatShares(r.exercisedCount)}</td>
                    <td className="p-2 text-right tabular-nums">{formatShares(r.cancelledCount)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {formatCurrency(r.strikePrice.toString(), "USD", "en-US", 4)}
                    </td>
                    <td className="p-2">{formatDate(r.grantDate)}</td>
                    <td className="p-2 text-muted-foreground">
                      {r.vestingDurationMonths
                        ? `${r.vestingDurationMonths}mo / ${r.vestingCliffMonths ?? 0}mo cliff`
                        : "—"}
                    </td>
                    <td className="p-2">{r.status}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      No option grants yet
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
