import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatShares } from "@/lib/formatters";

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
        <h1 className="text-2xl font-semibold tracking-tight">Security Classes</h1>
        <p className="text-sm text-muted-foreground">Common, preferred, option pools, warrants.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} classes</CardTitle>
          <CardDescription>Ordered by seniority for liquidation preference.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-right">Authorized</th>
                  <th className="p-2 text-right">Reserved Pool</th>
                  <th className="p-2 text-right">Seniority</th>
                  <th className="p-2 text-right">Liq Pref</th>
                  <th className="p-2 text-left">Participation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2">
                      <Badge variant="secondary">{r.type}</Badge>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.authorizedShares ? formatShares(r.authorizedShares) : "—"}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.reservedUngrantedShares ? formatShares(r.reservedUngrantedShares) : "—"}
                    </td>
                    <td className="p-2 text-right">{r.seniorityOrder}</td>
                    <td className="p-2 text-right">
                      {r.liquidationPreferenceMultiple ? `${r.liquidationPreferenceMultiple}x` : "—"}
                    </td>
                    <td className="p-2">{r.participationRights ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      No security classes yet
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
