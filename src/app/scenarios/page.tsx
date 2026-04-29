import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";

const ROUND_LABEL: Record<string, string> = {
  PRICED_ROUND: "Priced round",
  NEW_SAFE: "SAFE bridge",
  NEW_NOTE: "Note bridge",
  ACCELERATOR_EQUITY: "Accelerator",
  BRIDGE: "Bridge",
};

export default async function ScenariosPage() {
  const companyId = await getPrimaryCompanyId();
  const rows = companyId
    ? await prisma.scenario.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        include: {
          roundInput: true,
          newInstrumentInputs: { select: { id: true, type: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scenarios</h1>
          <p className="text-sm text-muted-foreground">
            Model your next round before signing.
          </p>
        </div>
        <Button asChild>
          <Link href="/scenarios/new">+ New scenario</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No scenarios yet</CardTitle>
            <CardDescription>
              Build your first dilution model to see how a priced round or new
              SAFE would affect ownership.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/scenarios/new">Build a scenario</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((s) => {
            const ri = s.roundInput;
            const pre = ri?.preMoneyValuation
              ? Number(ri.preMoneyValuation)
              : null;
            const newMoney = ri?.newMoney ? Number(ri.newMoney) : null;
            const post =
              pre != null && newMoney != null ? pre + newMoney : null;
            const instrumentCounts = s.newInstrumentInputs.reduce(
              (acc, i) => {
                acc[i.type] = (acc[i.type] ?? 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            );
            const instrumentSummary = Object.entries(instrumentCounts)
              .map(
                ([t, n]) =>
                  `${n}× ${t.replace("NEW_", "").toLowerCase()}`,
              )
              .join(" · ");

            return (
              <Card key={s.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">
                        <Link
                          className="hover:underline"
                          href={`/scenarios/${s.id}`}
                        >
                          {s.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {s.description ?? "No description"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {ROUND_LABEL[ri?.roundType ?? ""] ??
                        ri?.roundType ??
                        "—"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-2.5 text-xs">
                    <Stat
                      label="Pre-money"
                      value={pre != null ? formatCurrency(pre) : "—"}
                    />
                    <Stat
                      label="New money"
                      value={newMoney != null ? formatCurrency(newMoney) : "—"}
                    />
                    <Stat
                      label="Post-money"
                      value={post != null ? formatCurrency(post) : "—"}
                      emphasize
                    />
                  </div>
                  {instrumentSummary && (
                    <p className="text-xs text-muted-foreground">
                      New instruments:{" "}
                      <span className="text-foreground">
                        {instrumentSummary}
                      </span>
                    </p>
                  )}
                  {ri?.optionPoolTopUpMode &&
                    ri.optionPoolTopUpMode !== "NONE" && (
                      <p className="text-xs text-muted-foreground">
                        Pool top-up:{" "}
                        <span className="text-foreground">
                          {ri.optionPoolTopUpMode.replace(/_/g, " ").toLowerCase()}
                          {ri.optionPoolTargetPercent
                            ? ` → ${(Number(ri.optionPoolTargetPercent) * 100).toFixed(1)}%`
                            : ""}
                        </span>
                      </p>
                    )}
                </CardContent>
                <div className="flex items-center justify-between border-t px-6 py-3">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(s.createdAt)}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/scenarios/${s.id}`}>
                      Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          emphasize
            ? "font-semibold tabular-nums"
            : "tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
