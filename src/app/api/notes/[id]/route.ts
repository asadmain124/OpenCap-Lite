import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateConvertibleNoteSchema } from "@/lib/validators";
import { ok, noContent, toApiError } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await prisma.convertibleNote.findUniqueOrThrow({
      where: { id: params.id },
      include: { stakeholder: true },
    });
    return ok(row);
  } catch (e) {
    return toApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = updateConvertibleNoteSchema.parse(body);
    const row = await prisma.convertibleNote.update({ where: { id: params.id }, data });
    return ok(row);
  } catch (e) {
    return toApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.convertibleNote.delete({ where: { id: params.id } });
    return noContent();
  } catch (e) {
    return toApiError(e);
  }
}
