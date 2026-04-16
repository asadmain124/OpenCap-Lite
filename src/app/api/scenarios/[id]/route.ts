import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateScenarioSchema } from "@/lib/validators";
import { ok, noContent, toApiError } from "@/lib/api/response";

function toJson(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? {})) as Prisma.InputJsonValue;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await prisma.scenario.findUniqueOrThrow({
      where: { id: params.id },
      include: { roundInput: true, newInstrumentInputs: true },
    });
    return ok(row);
  } catch (e) {
    return toApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = updateScenarioSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      let scenario;
      if (data.scenario) {
        const { snapshotJson: snap, ...rest } = data.scenario;
        scenario = await tx.scenario.update({
          where: { id: params.id },
          data: {
            ...rest,
            ...(snap !== undefined
              ? { snapshotJson: snap ? toJson(snap) : Prisma.JsonNull }
              : {}),
          },
        });
      } else {
        scenario = await tx.scenario.findUniqueOrThrow({ where: { id: params.id } });
      }

      let roundInput = null;
      if (data.roundInput) {
        const ri = data.roundInput;
        roundInput = await tx.scenarioRoundInput.upsert({
          where: { scenarioId: params.id },
          create: {
            scenarioId: params.id,
            roundType: ri.roundType ?? "PRICED_ROUND",
            optionPoolTopUpMode: ri.optionPoolTopUpMode ?? "NONE",
            capDenominatorMethod: ri.capDenominatorMethod ?? "CURRENT_FULLY_DILUTED",
            preMoneyDenominatorMethod: ri.preMoneyDenominatorMethod ?? "CURRENT_FULLY_DILUTED",
            conversionOrderingRule: ri.conversionOrderingRule ?? "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
            notesConvertUsing: ri.notesConvertUsing ?? "BEST_FOR_INVESTOR",
            safesConvertUsing: ri.safesConvertUsing ?? "BEST_FOR_INVESTOR",
            preMoneyValuation: ri.preMoneyValuation ?? null,
            newMoney: ri.newMoney ?? null,
            pricedRoundPricePerShareOverride: ri.pricedRoundPricePerShareOverride ?? null,
            roundCloseDate: ri.roundCloseDate ?? null,
            optionPoolTargetPercent: ri.optionPoolTargetPercent ?? null,
            optionPoolFixedShares: ri.optionPoolFixedShares ?? null,
            optionPoolFixedPercentPreMoney: ri.optionPoolFixedPercentPreMoney ?? null,
            capDenominatorOverride: ri.capDenominatorOverride ?? null,
            preMoneyDenominatorOverride: ri.preMoneyDenominatorOverride ?? null,
            mfnFallback: ri.mfnFallback ?? null,
            includeProRata: ri.includeProRata ?? false,
          },
          update: ri,
        });
      } else {
        roundInput = await tx.scenarioRoundInput.findUnique({ where: { scenarioId: params.id } });
      }

      let instruments;
      if (data.newInstrumentInputs) {
        await tx.scenarioNewInstrumentInput.deleteMany({ where: { scenarioId: params.id } });
        instruments = await Promise.all(
          data.newInstrumentInputs.map((i) =>
            tx.scenarioNewInstrumentInput.create({
              data: {
                type: i.type,
                label: i.label,
                notesJson: toJson(i.notesJson),
                scenarioId: params.id,
              },
            }),
          ),
        );
      } else {
        instruments = await tx.scenarioNewInstrumentInput.findMany({
          where: { scenarioId: params.id },
        });
      }

      return { ...scenario, roundInput, newInstrumentInputs: instruments };
    });

    return ok(updated);
  } catch (e) {
    return toApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.scenario.delete({ where: { id: params.id } });
    return noContent();
  } catch (e) {
    return toApiError(e);
  }
}
