import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeFullyDiluted } from "@/lib/scenario-engine/fully-diluted";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatShares } from "@/lib/formatters";

async function getFirstCompanyId(): Promise<string | null> {
  const first = await prisma.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return first?.id ?? null;
}

async function loadSummary(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      securityClasses: true,
      holdings: true,
      optionGrants: true,
      safes: true,
      notes: true,
      stakeholders: { select: { id: true } },
      scenarios: { select: { id: true } },
    },
  });
  const secTypeById = new Map(company.securityClasses.map((s) => [s.id, s.type]));
  let commonShares = 0n;
  let preferredShares = 0n;
  for (const h of company.holdings) {
    if (h.status !== "ACTIVE") continue;
    const t = secTypeById.get(h.securityClassId);
    if (t === "PREFERRED") preferredShares += h.shareCount;
    else commonShares += h.shareCount;
  }
  let optionsGranted = 0n;
  let optionsExercised = 0n;
  for (const g of company.optionGrants) {
    if (g.status !== "ACTIVE") continue;
    optionsGranted += g.optionCount - g.cancelledCount;
    optionsExercised += g.exercisedCount;
  }
  const reservedPool = company.securityClasses
    .filter((s) => s.type === "OPTION_POOL")
    .reduce((acc, s) => acc + (s.reservedUngrantedShares ?? 0n), 0n);
  const fd = computeFullyDiluted({
    holdings: company.holdings.map((h) => ({ shareCount: h.shareCount, status: h.status })),
    optionGrants: company.optionGrants.map((g) => ({
      optionCount: g.optionCount,
      cancelledCount: g.cancelledCount,
      status: g.status,
    })),
    reservedUngrantedPool: reservedPool,
    settings: { includeAllGrantedOptions: true, includeCancelledGrants: false, includeReservedUngranted: true },
  });
  const safeTotal = company.safes
    .filter((s) => s.status === "OUTSTANDING")
    .reduce((acc, s) => acc + Number(s.purchaseAmount), 0);
  const noteTotal = company.notes
    .filter((n) => n.status === "OUTSTANDING")
    .reduce((acc, n) => acc + Number(n.principal), 0);
  return {
    company,
    commonShares,
    preferredShares,
    optionsGranted,
    optionsExercised,
    reservedPool,
    fullyDiluted: fd.fullyDiluted,
    fdBreakdown: fd.breakdown,
    safeCount: company.safes.filter((s) => s.status === "OUTSTANDING").length,
    safeTotal,
    noteCount: company.notes.filter((n) => n.status === "OUTSTANDING").length,
    noteTotal,
    stakeholderCount: company.stakeholders.length,
    scenarioCount: company.scenarios.length,
  };
}

interface StatCardProps {
  title: string;
  value: string;
  description?: string;
}

function StatCard({ title, value, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {description && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      )}
    </Card>
  );
}

export default async function DashboardPage() {
  const companyId = await getFirstCompanyId();
  if (!companyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <Card>
          <CardHeader>
            <CardTitle>No company yet</CardTitle>
            <CardDescription>
              Create your first company to get started with OpenCap Lite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings">Create a Company</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = await loadSummary(companyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {s.company.legalName} · {s.stakeholderCount} stakeholders · {s.scenarioCount} scenarios
          </p>
        </div>
        <Button asChild>
          <Link href="/scenarios/new">+ New Scenario</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Common Shares" value={formatShares(s.commonShares)} description="All active common holdings" />
        <StatCard title="Preferred Shares" value={formatShares(s.preferredShares)} description="Active preferred holdings" />
        <StatCard title="Options Granted" value={formatShares(s.optionsGranted)} description="Active outstanding options" />
        <StatCard title="Options Exercised" value={formatShares(s.optionsExercised)} description="Exercised to date" />
        <StatCard title="Outstanding SAFEs" value={String(s.safeCount)} description={formatCurrency(s.safeTotal)} />
        <StatCard title="SAFEs Total" value={formatCurrency(s.safeTotal)} />
        <StatCard title="Outstanding Notes" value={String(s.noteCount)} description={formatCurrency(s.noteTotal)} />
        <StatCard title="Notes Principal" value={formatCurrency(s.noteTotal)} />
      </div>

      <Card className="border-primary/40">
        <CardHeader>
          <CardDescription>Fully Diluted Capitalization (current)</CardDescription>
          <CardTitle className="text-5xl tabular-nums">{formatShares(s.fullyDiluted)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formatShares(s.fdBreakdown.common)} issued · {formatShares(s.fdBreakdown.options)} granted options ·{" "}
            {formatShares(s.fdBreakdown.reserved)} reserved pool
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
