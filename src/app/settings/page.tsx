import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPrimaryCompanyId } from "@/lib/company-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const companyId = await getPrimaryCompanyId();
  const company = companyId
    ? await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Company, modeling assumptions, and global preferences.</p>
      </div>

      {company && (
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>Core issuer details. Edit in place via the Cap Table CRUD UI.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Legal name</span>
              <p className="font-medium">{company.legalName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Jurisdiction</span>
              <p className="font-medium">{company.jurisdiction}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Authorized common</span>
              <p className="font-medium tabular-nums">{company.authorizedCommonShares.toString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Authorized preferred</span>
              <p className="font-medium tabular-nums">{company.authorizedPreferredShares.toString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Default currency</span>
              <p className="font-medium">{company.defaultCurrency}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Company ID</span>
              <p className="font-mono text-xs">{company.id}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <SettingsClient companyId={companyId ?? null} />

      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>Take your cap table with you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {companyId && (
            <div className="space-y-2">
              <p className="text-muted-foreground">Download the complete OCF v1.2.0 package:</p>
              <a
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 hover:bg-muted"
                href={`/api/companies/${companyId}/ocf/export`}
              >
                Download OCF zip
              </a>
            </div>
          )}
          <Separator />
          <div className="space-y-2">
            <p className="text-muted-foreground">Per-entity CSV exports:</p>
            <div className="flex flex-wrap gap-2">
              {companyId &&
                ["stakeholders", "holdings", "option-grants", "safes", "notes"].map((et) => (
                  <a
                    key={et}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    href={`/api/companies/${companyId}/csv/${et}`}
                  >
                    {et}.csv
                  </a>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About &amp; Limitations</CardTitle>
          <CardDescription>What this tool will and won&rsquo;t do.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            OpenCap Lite is a modeling tool, not legal, tax, or accounting advice. Always validate results
            with your attorney and CPA before making decisions.
          </p>
          <div>
            <Link href="/docs/KNOWN_LIMITATIONS.md" className="text-primary hover:underline">
              View Known Limitations →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">MIT licensed</Badge>
            <Badge variant="secondary">OCF v1.2.0</Badge>
            <Badge variant="secondary">Self-hosted</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
