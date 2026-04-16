import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateCompanySchema } from "@/lib/validators";
import { ok, noContent, toApiError } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await prisma.company.findUniqueOrThrow({ where: { id: params.id } });
    return ok(row);
  } catch (e) {
    return toApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = updateCompanySchema.parse(body);
    const row = await prisma.company.update({
      where: { id: params.id },
      data: {
        ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
        ...(data.jurisdiction !== undefined ? { jurisdiction: data.jurisdiction } : {}),
        ...(data.incorporationDate !== undefined ? { incorporationDate: data.incorporationDate } : {}),
        ...(data.authorizedCommonShares !== undefined ? { authorizedCommonShares: data.authorizedCommonShares } : {}),
        ...(data.authorizedPreferredShares !== undefined ? { authorizedPreferredShares: data.authorizedPreferredShares } : {}),
        ...(data.defaultCurrency !== undefined ? { defaultCurrency: data.defaultCurrency } : {}),
      },
    });
    return ok(row);
  } catch (e) {
    return toApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.company.delete({ where: { id: params.id } });
    return noContent();
  } catch (e) {
    return toApiError(e);
  }
}
