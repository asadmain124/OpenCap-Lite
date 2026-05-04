import Link from "next/link";
import {
  FlaskConical,
  Layers,
  Plus,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { computeFullyDiluted } from "@/lib/scenario-engine/fully-diluted";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatShares } from "@/lib/formatters";
import { EmptyDashboard } from "@/components/app/EmptyDashboard";
import { OnboardingWizard } from "@/components/app/OnboardingWizard";

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
  const secTypeById = new Map(
    company.securityClasses.map((s) => [s.id, s.type]),
  );
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
    holdings: company.holdings.map((h) => ({
      shareCount: h.shareCount,
      status: h.status,
    })),
    optionGrants: company.optionGrants.map((g) => ({
      optionCount: g.optionCount,
      cancelledCount: g.cancelledCount,
      status: g.status,
    })),
    reservedUngrantedPool: reservedPool,
    settings: {
      includeAllGrantedOptions: true,
      includeCancelledGrants: false,
      includeReservedUngranted: true,
    },
  });
  const outstandingSafes = company.safes.filter(
    (s) => s.status === "OUTSTANDING",
  );
  const outstandingNotes = company.notes.filter(
    (n) => n.status === "OUTSTANDING",
  );
  const safeTotal = outstandingSafes.reduce(
    (acc, s) => acc + Number(s.purchaseAmount),
    0,
  );
  const noteTotal = outstandingNotes.reduce(
    (acc, n) => acc + Number(n.principal),
    0,
  );
  return {
    company,
    commonShares,
    preferredShares,
    optionsGranted,
    optionsExercised,
    reservedPool,
    fullyDiluted: fd.fullyDiluted,
    fdBreakdown: fd.breakdown,
    safeCount: outstandingSafes.length,
    safeTotal,
    noteCount: outstandingNotes.length,
    noteTotal,
    stakeholderCount: company.stakeholders.length,
    scenarioCount: company.scenarios.length,
  };
}

interface StatTileProps {
  title: string;
  value: string;
  description?: string;
  href: string;
}

function StatTile({ title, value, description, href }: StatTileProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full transition-colors hover:bg-accent/40">
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
    </Link>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  icon: LucideIcon;
}

function QuickAction({ href, label, icon: Icon }: QuickActionProps) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        <Icon className="mr-1 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

export default async function DashboardPage() {
  const companyId = await getPrimaryCompanyId();
  if (!companyId) return <EmptyDashboard />;

  const s = await loadSummary(companyId);
  const isEmptyCapTable =
    s.commonShares === 0n &&
    s.preferredShares === 0n &&
    s.optionsGranted === 0n &&
    s.safeCount === 0 &&
    s.noteCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {s.company.legalName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {s.stakeholderCount} stakeholder{s.stakeholderCount === 1 ? "" : "s"}
            {" · "}
            {s.scenarioCount} scenario{s.scenarioCount === 1 ? "" : "s"}
            {" · "}
            {s.company.jurisdiction}
          </p>
        </div>
        <Button asChild>
          <Link href="/scenarios/new">
            <Plus className="mr-1 h-4 w-4" />
            New scenario
          </Link>
        </Button>
      </div>

      <Card className="border-primary/40">
        <CardHeader className="pb-2">
          <CardDescription>Fully Diluted Capitalization</CardDescription>
          <CardTitle className="text-5xl tabular-nums">
            {formatShares(s.fullyDiluted)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formatShares(s.fdBreakdown.common)} issued ·{" "}
            {formatShares(s.fdBreakdown.options)} granted options ·{" "}
            {formatShares(s.fdBreakdown.reserved)} reserved pool
          </p>
        </CardContent>
      </Card>

      {(s.safeCount > 0 || s.noteCount > 0) && (
        <Card className="border-dashed bg-accent/30">
          <CardHeader className="pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">
                You have {s.safeCount + s.noteCount} convertible
                {s.safeCount + s.noteCount === 1 ? "" : "s"} outstanding
              </CardTitle>
              <CardDescription>
                {s.safeCount > 0 && `${formatCurrency(s.safeTotal)} in SAFEs`}
                {s.safeCount > 0 && s.noteCount > 0 && " · "}
                {s.noteCount > 0 && `${formatCurrency(s.noteTotal)} in notes`}
                {" · model what happens at your next priced round."}
              </CardDescription>
            </div>
            <Button asChild className="mt-3 sm:mt-0">
              <Link href="/scenarios/new">
                <TrendingUp className="mr-1 h-4 w-4" />
                Model next round
              </Link>
            </Button>
          </CardHeader>
        </Card>
      )}

      {isEmptyCapTable ? (
        <>
          <OnboardingWizard companyId={companyId} />
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                Prefer to add things one at a time? Use these instead.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <QuickAction
                href="/cap-table/stakeholders"
                label="Add stakeholder"
                icon={Users}
              />
              <QuickAction
                href="/cap-table/holdings"
                label="Issue holding"
                icon={Layers}
              />
              <QuickAction
                href="/cap-table/safes"
                label="Add SAFE"
                icon={Plus}
              />
              <QuickAction
                href="/cap-table/notes"
                label="Add note"
                icon={Plus}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <QuickAction
              href="/cap-table/ownership"
              label="View ownership"
              icon={Layers}
            />
            <QuickAction
              href="/cap-table/stakeholders"
              label="Add stakeholder"
              icon={Users}
            />
            <QuickAction
              href="/cap-table/holdings"
              label="Issue holdings"
              icon={Plus}
            />
            <QuickAction
              href="/cap-table/safes"
              label="Add SAFE"
              icon={Plus}
            />
            <QuickAction
              href="/scenarios"
              label="All scenarios"
              icon={FlaskConical}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              title="Common shares"
              value={formatShares(s.commonShares)}
              description="Active common holdings"
              href="/cap-table/holdings"
            />
            {s.preferredShares > 0n && (
              <StatTile
                title="Preferred shares"
                value={formatShares(s.preferredShares)}
                description="Active preferred holdings"
                href="/cap-table/holdings"
              />
            )}
            {s.optionsGranted > 0n && (
              <StatTile
                title="Options outstanding"
                value={formatShares(s.optionsGranted)}
                description={
                  s.optionsExercised > 0n
                    ? `${formatShares(s.optionsExercised)} exercised`
                    : "Granted, unexercised"
                }
                href="/cap-table/option-grants"
              />
            )}
            {s.safeCount > 0 && (
              <StatTile
                title="SAFEs outstanding"
                value={`${s.safeCount} · ${formatCurrency(s.safeTotal)}`}
                description="Click to view, edit, or convert"
                href="/cap-table/safes"
              />
            )}
            {s.noteCount > 0 && (
              <StatTile
                title="Notes outstanding"
                value={`${s.noteCount} · ${formatCurrency(s.noteTotal)}`}
                description="Principal across active notes"
                href="/cap-table/notes"
              />
            )}
            <StatTile
              title="Reserved pool"
              value={formatShares(s.reservedPool)}
              description={
                s.reservedPool > 0n
                  ? "Available for future grants"
                  : "No reserved option pool yet"
              }
              href="/cap-table/security-classes"
            />
          </div>
        </>
      )}
    </div>
  );
}
