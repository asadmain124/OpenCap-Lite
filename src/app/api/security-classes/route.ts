import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSecurityClassSchema } from "@/lib/validators";
import { ok, created, toApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
    const rows = await prisma.securityClass.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: [{ seniorityOrder: "asc" }, { name: "asc" }],
    });
    return ok(rows, { count: rows.length });
  } catch (e) {
    return toApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createSecurityClassSchema.parse(body);
    const row = await prisma.securityClass.create({ data });
    return created(row);
  } catch (e) {
    return toApiError(e);
  }
}
