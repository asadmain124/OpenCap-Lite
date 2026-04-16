import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { computeFullyDiluted } from "@/lib/scenario-engine/fully-diluted";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShares, formatPercent } from "@/lib/formatters";

interface OwnershipRow {
  stakeholderName: string;
  source: string;
  shares: bigint;
}

export default async function OwnershipPage() {
  const companyId = await getPrimaryCompanyId();
  if (!companyId) return <EmptyState />;

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      stakeholders: true,
      securityClasses: true,
      holdings: { include: { stakeholder: true, securityClass: true } },
      optionGrants: { include: { stakeholder: true } },
      safes: { include: { stakeholder: true } },
      notes: { include: { stakeholder: true } },
    },
  });

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

  const rows: OwnershipRow[] = [];
  for (const h of company.holdings) {
    if (h.status !== "ACTIVE") continue;
    rows.push({
      stakeholderName: h.stakeholder.name,
      source: h.securityClass.name,
      shares: h.shareCount,
    });
  }
  for (const g of company.optionGrants) {
    if (g.status !== "ACTIVE") continue;
    rows.push({
      stakeholderName: g.stakeholder.name,
      source: "Options (granted)",
      shares: g.optionCount - g.cancelledCount,
    });
  }
  if (reservedPool > 0n) {
    rows.push({ stakeholderName: "Reserved Pool", source: "Option Pool", shares: reservedPool });
  }

  rows.sort((a, b) => (a.shares > b.shares ? -1 : 1));

  const fdDec = new Decimal(fd.fullyDiluted.toString());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ownership Summary</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Fully Diluted</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{formatShares(fd.fullyDiluted)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Issued (common + preferred)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{formatShares(fd.breakdown.common)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Options & Pool</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatShares(fd.breakdown.options + fd.breakdown.reserved)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By Stakeholder</CardTitle>
          <CardDescription>Shows on-cap-table positions only — pre-conversion.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Stakeholder</th>
                  <th className="p-2 text-left">Source</th>
                  <th className="p-2 text-right">Shares</th>
                  <th className="p-2 text-right">% FD</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const pct = fdDec.isZero()
                    ? new Decimal(0)
                    : new Decimal(r.shares.toString()).div(fdDec);
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2">{r.stakeholderName}</td>
                      <td className="p-2 text-muted-foreground">{r.source}</td>
                      <td className="p-2 text-right tabular-nums">{formatShares(r.shares)}</td>
                      <td className="p-2 text-right tabular-nums">{formatPercent(pct.toNumber(), "en-US", 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No data</CardTitle>
        <CardDescription>Create a company first.</CardDescription>
      </CardHeader>
    </Card>
  );
}
