import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateOptionGrantSchema } from "@/lib/validators";
import { ok, noContent, toApiError } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await prisma.optionGrant.findUniqueOrThrow({
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
    const parsed = updateOptionGrantSchema.parse(body);
    const { vesting, ...rest } = parsed;
    const data = {
      ...rest,
      ...(vesting
        ? {
            vestingStartDate: vesting.vestingStartDate ?? null,
            vestingCliffMonths: vesting.vestingCliffMonths ?? null,
            vestingDurationMonths: vesting.vestingDurationMonths ?? null,
            vestingFrequency: vesting.vestingFrequency ?? "NONE",
          }
        : {}),
    };
    const row = await prisma.optionGrant.update({ where: { id: params.id }, data });
    return ok(row);
  } catch (e) {
    return toApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.optionGrant.delete({ where: { id: params.id } });
    return noContent();
  } catch (e) {
    return toApiError(e);
  }
}
