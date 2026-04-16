import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCsv, parseCsv } from "@/lib/csv";
import { toApiError, ok } from "@/lib/api/response";

const ENTITY_TYPES = [
  "stakeholders",
  "holdings",
  "option-grants",
  "safes",
  "notes",
] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; entityType: string } },
) {
  try {
    if (!isEntityType(params.entityType)) {
      return NextResponse.json(
        { error: `Unknown entity type: ${params.entityType}`, code: "INVALID_ENTITY" },
        { status: 400 },
      );
    }
    const companyId = params.id;
    let csv = "";
    if (params.entityType === "stakeholders") {
      const rows = await prisma.stakeholder.findMany({ where: { companyId }, orderBy: { name: "asc" } });
      csv = buildCsv(rows, [
        { key: "id", header: "ID" },
        { key: "name", header: "Name" },
        { key: "type", header: "Type" },
        { key: "email", header: "Email" },
        { key: "notes", header: "Notes" },
      ]);
    } else if (params.entityType === "holdings") {
      const rows = await prisma.equityHolding.findMany({
        where: { companyId },
        include: { stakeholder: true, securityClass: true },
      });
      csv = buildCsv(rows, [
        { key: "id", header: "ID" },
        { key: "stakeholder", header: "Stakeholder", format: (_, r) => r.stakeholder.name },
        { key: "securityClass", header: "Security Class", format: (_, r) => r.securityClass.name },
        { key: "shareCount", header: "Shares", format: (v) => (v as bigint).toString() },
        { key: "pricePaidPerShare", header: "Price Per Share", format: (v) => (v == null ? "" : String(v)) },
        { key: "issueDate", header: "Issue Date", format: (v) => (v as Date).toISOString().slice(0, 10) },
        { key: "status", header: "Status" },
      ]);
    } else if (params.entityType === "option-grants") {
      const rows = await prisma.optionGrant.findMany({
        where: { companyId },
        include: { stakeholder: true },
      });
      csv = buildCsv(rows, [
        { key: "id", header: "ID" },
        { key: "stakeholder", header: "Stakeholder", format: (_, r) => r.stakeholder.name },
        { key: "optionCount", header: "Options Granted", format: (v) => (v as bigint).toString() },
        { key: "exercisedCount", header: "Options Exercised", format: (v) => (v as bigint).toString() },
        { key: "cancelledCount", header: "Options Cancelled", format: (v) => (v as bigint).toString() },
        { key: "strikePrice", header: "Strike Price", format: (v) => String(v) },
        { key: "grantDate", header: "Grant Date", format: (v) => (v as Date).toISOString().slice(0, 10) },
        { key: "status", header: "Status" },
      ]);
    } else if (params.entityType === "safes") {
      const rows = await prisma.sAFEInstrument.findMany({
        where: { companyId },
        include: { stakeholder: true },
      });
      csv = buildCsv(rows, [
        { key: "id", header: "ID" },
        { key: "stakeholder", header: "Stakeholder", format: (_, r) => r.stakeholder.name },
        { key: "issueDate", header: "Issue Date", format: (v) => (v as Date).toISOString().slice(0, 10) },
        { key: "purchaseAmount", header: "Purchase Amount", format: (v) => String(v) },
        { key: "valuationCap", header: "Valuation Cap", format: (v) => (v == null ? "" : String(v)) },
        { key: "discountPercent", header: "Discount %", format: (v) => (v == null ? "" : String(v)) },
        { key: "postMoney", header: "Post-Money" },
        { key: "mfn", header: "MFN" },
        { key: "status", header: "Status" },
      ]);
    } else if (params.entityType === "notes") {
      const rows = await prisma.convertibleNote.findMany({
        where: { companyId },
        include: { stakeholder: true },
      });
      csv = buildCsv(rows, [
        { key: "id", header: "ID" },
        { key: "stakeholder", header: "Stakeholder", format: (_, r) => r.stakeholder.name },
        { key: "issueDate", header: "Issue Date", format: (v) => (v as Date).toISOString().slice(0, 10) },
        { key: "maturityDate", header: "Maturity Date", format: (v) => (v == null ? "" : (v as Date).toISOString().slice(0, 10)) },
        { key: "principal", header: "Principal", format: (v) => String(v) },
        { key: "annualInterestRatePercent", header: "Interest Rate %", format: (v) => String(v) },
        { key: "interestType", header: "Interest Type" },
        { key: "compoundingFrequencyPerYear", header: "Compounding Freq" },
        { key: "valuationCap", header: "Valuation Cap", format: (v) => (v == null ? "" : String(v)) },
        { key: "discountPercent", header: "Discount %", format: (v) => (v == null ? "" : String(v)) },
        { key: "status", header: "Status" },
      ]);
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${params.entityType}-${companyId}.csv"`,
      },
    });
  } catch (e) {
    return toApiError(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; entityType: string } },
) {
  try {
    if (!isEntityType(params.entityType)) {
      return NextResponse.json(
        { error: `Unknown entity type: ${params.entityType}`, code: "INVALID_ENTITY" },
        { status: 400 },
      );
    }
    const contentType = req.headers.get("content-type") ?? "";
    let raw: string;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing 'file' field", code: "MISSING_FILE" }, { status: 400 });
      }
      raw = await file.text();
    } else {
      raw = await req.text();
    }
    const companyId = params.id;
    const created: string[] = [];
    const failures: { row: number; error: string }[] = [];

    if (params.entityType === "stakeholders") {
      const parsed = parseCsv(raw, (r) => ({
        companyId,
        name: r.Name?.trim() ?? "",
        type: (r.Type ?? "OTHER").toUpperCase() as
          | "FOUNDER"
          | "EMPLOYEE"
          | "ADVISOR"
          | "ANGEL"
          | "VC"
          | "ACCELERATOR"
          | "OTHER",
        email: r.Email?.trim() || null,
        notes: r.Notes?.trim() || null,
      }));
      failures.push(...parsed.failures);
      for (let i = 0; i < parsed.rows.length; i++) {
        try {
          const row = await prisma.stakeholder.create({ data: parsed.rows[i] });
          created.push(row.id);
        } catch (err) {
          failures.push({ row: i + 2, error: err instanceof Error ? err.message : String(err) });
        }
      }
    } else {
      // Other entity types are more complex — basic support for stakeholders only.
      // Additional types can be added when requested; return a clear error.
      return NextResponse.json(
        {
          error: `CSV import for ${params.entityType} is not yet supported; export is available`,
          code: "IMPORT_UNSUPPORTED",
        },
        { status: 400 },
      );
    }

    return ok({ created: created.length, failed: failures });
  } catch (e) {
    return toApiError(e);
  }
}
