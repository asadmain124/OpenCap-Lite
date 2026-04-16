import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";

export default async function ScenariosPage() {
  const companyId = await getPrimaryCompanyId();
  const rows = companyId
    ? await prisma.scenario.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        include: { roundInput: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scenarios</h1>
          <p className="text-sm text-muted-foreground">Model your next round before signing.</p>
        </div>
        <Button asChild>
          <Link href="/scenarios/new">+ New Scenario</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No scenarios yet</CardTitle>
            <CardDescription>
              Build your first dilution model to see how a priced round or new SAFE would affect ownership.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/scenarios/new">Build a Scenario</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>
                      <Link className="hover:underline" href={`/scenarios/${s.id}`}>
                        {s.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>{s.description ?? "No description"}</CardDescription>
                  </div>
                  <Badge variant="secondary">{s.roundInput?.roundType ?? "—"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Created {formatDate(s.createdAt)}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/scenarios/${s.id}`}>Open →</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
