import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadSerializedBaseline } from "@/lib/baseline";
import { ScenarioBuilder, type InitialScenarioState } from "@/components/scenario/ScenarioBuilder";

type PayloadRound = InitialScenarioState["round"];

export default async function ScenarioDetailPage({ params }: { params: { id: string } }) {
  const scenario = await prisma.scenario.findUnique({
    where: { id: params.id },
    include: { roundInput: true, newInstrumentInputs: true, company: true },
  });
  if (!scenario) notFound();

  const baseline = await loadSerializedBaseline(scenario.companyId);
  if (!baseline) notFound();

  const ri = scenario.roundInput;
  const round: PayloadRound = ri
    ? {
        roundType: ri.roundType as PayloadRound["roundType"],
        preMoneyValuation: ri.preMoneyValuation?.toString() ?? null,
        newMoney: ri.newMoney?.toString() ?? null,
        pricedRoundPricePerShareOverride: ri.pricedRoundPricePerShareOverride?.toString() ?? null,
        roundCloseDate: (ri.roundCloseDate ?? new Date()).toISOString().slice(0, 10),
        optionPoolTopUpMode: ri.optionPoolTopUpMode as PayloadRound["optionPoolTopUpMode"],
        optionPoolTargetPercent: ri.optionPoolTargetPercent?.toString() ?? null,
        optionPoolFixedShares: ri.optionPoolFixedShares?.toString() ?? null,
        optionPoolFixedPercentPreMoney: ri.optionPoolFixedPercentPreMoney?.toString() ?? null,
        capDenominatorMethod: ri.capDenominatorMethod as PayloadRound["capDenominatorMethod"],
        capDenominatorOverride: ri.capDenominatorOverride?.toString() ?? null,
        preMoneyDenominatorMethod: ri.preMoneyDenominatorMethod as PayloadRound["preMoneyDenominatorMethod"],
        preMoneyDenominatorOverride: ri.preMoneyDenominatorOverride?.toString() ?? null,
        conversionOrderingRule: ri.conversionOrderingRule as PayloadRound["conversionOrderingRule"],
        notesConvertUsing: ri.notesConvertUsing as PayloadRound["notesConvertUsing"],
        safesConvertUsing: ri.safesConvertUsing as PayloadRound["safesConvertUsing"],
        includeProRata: ri.includeProRata,
      }
    : {
        roundType: "PRICED_ROUND",
        preMoneyValuation: null,
        newMoney: null,
        pricedRoundPricePerShareOverride: null,
        roundCloseDate: new Date().toISOString().slice(0, 10),
        optionPoolTopUpMode: "NONE",
        optionPoolTargetPercent: null,
        optionPoolFixedShares: null,
        optionPoolFixedPercentPreMoney: null,
        capDenominatorMethod: "CURRENT_FULLY_DILUTED",
        capDenominatorOverride: null,
        preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED",
        preMoneyDenominatorOverride: null,
        conversionOrderingRule: "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
        notesConvertUsing: "BEST_FOR_INVESTOR",
        safesConvertUsing: "BEST_FOR_INVESTOR",
        includeProRata: false,
      };

  const newInstruments = scenario.newInstrumentInputs.map((i) => {
    const notes = i.notesJson as Record<string, unknown>;
    return {
      type: i.type as InitialScenarioState["newInstruments"][number]["type"],
      label: i.label,
      stakeholderName: String(notes.stakeholderName ?? ""),
      purchaseAmount: notes.purchaseAmount as string | undefined,
      valuationCap: notes.valuationCap as string | undefined,
      discountPercent: notes.discountPercent as string | undefined,
      investmentAmount: notes.investmentAmount as string | undefined,
      targetEquityPercent: notes.targetEquityPercent as string | undefined,
      principal: notes.principal as string | undefined,
      annualInterestRatePercent: notes.annualInterestRatePercent as string | undefined,
      interestType: notes.interestType as "SIMPLE" | "COMPOUND" | undefined,
      compoundingFrequencyPerYear: notes.compoundingFrequencyPerYear as number | null | undefined,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{scenario.name}</h1>
        <p className="text-sm text-muted-foreground">{scenario.description ?? "—"}</p>
      </div>
      <ScenarioBuilder
        companyId={scenario.companyId}
        baseline={baseline}
        initial={{
          id: scenario.id,
          name: scenario.name,
          description: scenario.description ?? "",
          round,
          newInstruments,
        }}
      />
    </div>
  );
}
