import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOptionGrantSchema } from "@/lib/validators";
import { ok, created, toApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
    const rows = await prisma.optionGrant.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { grantDate: "desc" },
      include: { stakeholder: true },
    });
    return ok(rows, { count: rows.length });
  } catch (e) {
    return toApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createOptionGrantSchema.parse(body);
    const row = await prisma.optionGrant.create({ data });
    return created(row);
  } catch (e) {
    return toApiError(e);
  }
}
