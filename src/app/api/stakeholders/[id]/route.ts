import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateStakeholderSchema } from "@/lib/validators";
import { ok, noContent, toApiError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await prisma.stakeholder.findUniqueOrThrow({ where: { id: params.id } });
    return ok(row);
  } catch (e) {
    return toApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = updateStakeholderSchema.parse(body);
    const before = await prisma.stakeholder.findUnique({ where: { id: params.id } });
    const row = await prisma.stakeholder.update({ where: { id: params.id }, data });
    await writeAuditLog({
      companyId: row.companyId,
      entityType: "Stakeholder",
      entityId: row.id,
      action: "UPDATE",
      before,
      after: row,
    });
    return ok(row);
  } catch (e) {
    return toApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const before = await prisma.stakeholder.findUnique({ where: { id: params.id } });
    await prisma.stakeholder.delete({ where: { id: params.id } });
    if (before) {
      await writeAuditLog({
        companyId: before.companyId,
        entityType: "Stakeholder",
        entityId: before.id,
        action: "DELETE",
        before,
      });
    }
    return noContent();
  } catch (e) {
    return toApiError(e);
  }
}
