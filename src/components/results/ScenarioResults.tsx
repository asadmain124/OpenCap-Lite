"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatShares, formatPercent } from "@/lib/formatters";

/**
 * Serialized ScenarioResult as it comes off the API: BigInt fields are
 * strings, Decimal fields are strings, Date fields are ISO strings.
 */
export interface SerializedOwnershipRow {
  stakeholderId: string | null;
  stakeholderName: string;
  securityType: string;
  shareCount: string;
  fullyDilutedShares: string;
  percentOfFD: string;
  group: string;
}

export interface SerializedConvertibleDetail {
  instrumentType: "SAFE" | "NOTE";
  instrumentId: string;
  stakeholderName: string;
  label: string;
  principal: string;
  accruedInterest: string;
  totalConversionAmount: string;
  capPrice: string | null;
  discountPrice: string | null;
  selectedPrice: string | null;
  selectedMethod: "CAP" | "DISCOUNT" | "UNRESOLVED_MFN";
  sharesIssued: string;
  explanation: string;
}

export interface SerializedWarning {
  code: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  entityType?: string;
  entityId?: string;
}

export interface SerializedStage {
  stageName: string;
  description: string;
  fullyDiluted: string;
  ownership: SerializedOwnershipRow[];
}

export interface SerializedScenarioResult {
  intermediates: {
    pricePerShare: string | null;
    pricePerShareMethod: string;
    preMoneyDenominatorShares: string;
    capDenominatorShares: string;
    baselineFullyDiluted: string;
    poolTopUpShares: string;
    poolTopUpMethod: string;
    newInvestorShares: string;
  };
  stages: SerializedStage[];
  finalOwnership: SerializedOwnershipRow[];
  convertibleDetails: SerializedConvertibleDetail[];
  warnings: SerializedWarning[];
  formulaTrace: string[];
}

function downloadBlob(filename: string, body: BlobPart, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function ownershipToCsv(rows: SerializedOwnershipRow[]): string {
  const header = ["Stakeholder", "Security", "Shares", "FD Shares", "% FD", "Group"];
  const body = rows.map((r) => [
    r.stakeholderName,
    r.securityType,
    r.shareCount,
    r.fullyDilutedShares,
    `${Number(r.percentOfFD).toFixed(4)}%`,
    r.group,
  ]);
  return [header, ...body].map((r) => r.join(",")).join("\n");
}

function conversionsToCsv(details: SerializedConvertibleDetail[]): string {
  const header = [
    "Type",
    "Instrument",
    "Holder",
    "Principal",
    "Accrued",
    "Total",
    "Cap Price",
    "Discount Price",
    "Selected Price",
    "Selected Method",
    "Shares Issued",
  ];
  const body = details.map((d) => [
    d.instrumentType,
    d.label,
    d.stakeholderName,
    d.principal,
    d.accruedInterest,
    d.totalConversionAmount,
    d.capPrice ?? "",
    d.discountPrice ?? "",
    d.selectedPrice ?? "",
    d.selectedMethod,
    d.sharesIssued,
  ]);
  return [header, ...body].map((r) => r.join(",")).join("\n");
}

export function ScenarioResults({
  result,
  scenarioName = "scenario",
  loading = false,
  error,
}: {
  result: SerializedScenarioResult | null;
  scenarioName?: string;
  loading?: boolean;
  error?: string | null;
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Calculation failed</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>Fill in the scenario assumptions on the left to see live results.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const finalStage = result.stages[result.stages.length - 1];
  const pps = result.intermediates.pricePerShare;

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          </span>
          Calculating…
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Price per share" value={pps ? `$${Number(pps).toFixed(4)}` : "—"} />
        <SummaryCard label="New investor shares" value={formatShares(result.intermediates.newInvestorShares)} />
        <SummaryCard label="Pool top-up" value={formatShares(result.intermediates.poolTopUpShares)} />
        <SummaryCard label="Post-money FD" value={formatShares(finalStage?.fullyDiluted ?? "0")} />
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((w, i) => (
            <Alert
              key={i}
              variant={w.severity === "critical" ? "destructive" : "warning"}
            >
              {w.severity === "critical" ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle className="text-sm">
                {w.code}{" "}
                <Badge variant="secondary" className="ml-1 text-[10px] uppercase">
                  {w.severity}
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-xs">{w.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Ownership by Stage</CardTitle>
          <CardDescription>
            {result.stages.length} stages — final cap table shown by default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue={`s-${result.stages.length - 1}`}>
            {result.stages.map((stage, i) => (
              <AccordionItem key={i} value={`s-${i}`}>
                <AccordionTrigger>
                  {stage.stageName} · FD {formatShares(stage.fullyDiluted)}
                </AccordionTrigger>
                <AccordionContent>
                  <OwnershipTable rows={stage.ownership} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Convertibles */}
      {result.convertibleDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convertible Conversions</CardTitle>
            <CardDescription>How each SAFE and note converted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.convertibleDetails.map((d) => (
              <div key={d.instrumentId} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {d.instrumentType} · {d.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{d.stakeholderName}</p>
                  </div>
                  <Badge variant={d.selectedMethod === "UNRESOLVED_MFN" ? "destructive" : "secondary"}>
                    {d.selectedMethod}
                  </Badge>
                </div>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                  <Kv k="Principal" v={formatCurrency(d.principal)} />
                  <Kv k="Accrued" v={formatCurrency(d.accruedInterest)} />
                  <Kv k="Total" v={formatCurrency(d.totalConversionAmount)} />
                  <Kv k="Cap Price" v={d.capPrice ? `$${Number(d.capPrice).toFixed(4)}` : "—"} />
                  <Kv k="Discount Price" v={d.discountPrice ? `$${Number(d.discountPrice).toFixed(4)}` : "—"} />
                  <Kv
                    k="Selected"
                    v={d.selectedPrice ? `$${Number(d.selectedPrice).toFixed(4)}` : "—"}
                  />
                  <Kv k="Shares" v={formatShares(d.sharesIssued)} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <Info className="mr-1 inline h-3 w-3" /> {d.explanation}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Formula trace */}
      <Card>
        <CardHeader>
          <CardTitle>Formulas &amp; Trace</CardTitle>
          <CardDescription>Every number above derived from these steps.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
            {result.formulaTrace.join("\n")}
          </pre>
        </CardContent>
      </Card>

      {/* Exports */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            downloadBlob(
              `${scenarioName}-ownership.csv`,
              ownershipToCsv(result.finalOwnership),
              "text/csv",
            )
          }
        >
          Export Ownership CSV
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadBlob(
              `${scenarioName}-conversions.csv`,
              conversionsToCsv(result.convertibleDetails),
              "text/csv",
            )
          }
        >
          Export Conversions CSV
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadBlob(
              `opencaplite-${scenarioName}-${new Date().toISOString().slice(0, 10)}.json`,
              JSON.stringify(result, null, 2),
              "application/json",
            )
          }
        >
          Export Full Scenario (JSON)
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

function OwnershipTable({ rows }: { rows: SerializedOwnershipRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-1.5 text-left">Holder</th>
            <th className="p-1.5 text-left">Security</th>
            <th className="p-1.5 text-right">Shares</th>
            <th className="p-1.5 text-right">% FD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="p-1.5">{r.stakeholderName}</td>
              <td className="p-1.5 text-muted-foreground">{r.securityType}</td>
              <td className="p-1.5 text-right tabular-nums">{formatShares(r.shareCount)}</td>
              <td className="p-1.5 text-right tabular-nums">
                {formatPercent(Number(r.percentOfFD) / 100, "en-US", 2)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="p-3 text-center text-muted-foreground">
                (empty)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
