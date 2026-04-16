import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createScenarioSchema } from "@/lib/validators";
import { ok, created, toApiError } from "@/lib/api/response";

function toJson(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? {})) as Prisma.InputJsonValue;
}

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
    const rows = await prisma.scenario.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { roundInput: true, newInstrumentInputs: true },
    });
    return ok(rows, { count: rows.length });
  } catch (e) {
    return toApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createScenarioSchema.parse(body);

    const created_ = await prisma.$transaction(async (tx) => {
      const scenario = await tx.scenario.create({
        data: {
          ...data.scenario,
          snapshotJson: data.scenario.snapshotJson
            ? toJson(data.scenario.snapshotJson)
            : Prisma.JsonNull,
        },
      });
      const round = await tx.scenarioRoundInput.create({
        data: { ...data.roundInput, scenarioId: scenario.id },
      });
      const instruments = await Promise.all(
        data.newInstrumentInputs.map((i) =>
          tx.scenarioNewInstrumentInput.create({
            data: {
              type: i.type,
              label: i.label,
              notesJson: toJson(i.notesJson),
              scenarioId: scenario.id,
            },
          }),
        ),
      );
      return { ...scenario, roundInput: round, newInstrumentInputs: instruments };
    });

    return created(created_);
  } catch (e) {
    return toApiError(e);
  }
}
