import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createConvertibleNoteSchema } from "@/lib/validators";
import { ok, created, toApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
    const rows = await prisma.convertibleNote.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { issueDate: "desc" },
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
    const data = createConvertibleNoteSchema.parse(body);
    const row = await prisma.convertibleNote.create({ data });
    return created(row);
  } catch (e) {
    return toApiError(e);
  }
}
