import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCompanySchema } from "@/lib/validators";
import { ok, created, toApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const rows = await prisma.company.findMany({ orderBy: { createdAt: "desc" } });
    return ok(rows, { count: rows.length });
  } catch (e) {
    return toApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createCompanySchema.parse(body);
    const row = await prisma.company.create({
      data: {
        legalName: data.legalName,
        jurisdiction: data.jurisdiction,
        incorporationDate: data.incorporationDate ?? null,
        authorizedCommonShares: data.authorizedCommonShares ?? 0n,
        authorizedPreferredShares: data.authorizedPreferredShares ?? 0n,
        defaultCurrency: data.defaultCurrency ?? "USD",
      },
    });
    return created(row);
  } catch (e) {
    return toApiError(e);
  }
}
