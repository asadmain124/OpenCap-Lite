import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStakeholderSchema } from "@/lib/validators";
import { ok, created, toApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
    const rows = await prisma.stakeholder.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { name: "asc" },
    });
    return ok(rows, { count: rows.length });
  } catch (e) {
    return toApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createStakeholderSchema.parse(body);
    const row = await prisma.stakeholder.create({ data });
    return created(row);
  } catch (e) {
    return toApiError(e);
  }
}
