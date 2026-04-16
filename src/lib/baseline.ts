import { prisma } from "@/lib/prisma";
import type { ScenarioInput } from "@/lib/scenario-engine/types";

/**
 * Server-side helper that returns a serialized baseline suitable for the
 * scenario engine / calculate endpoint. BigInts are stringified for wire
 * transport; client code converts back.
 */
export interface SerializedBaseline {
  companyName: string;
  authorizedCommonShares: string;
  authorizedPreferredShares: string;
  baseline: {
    holdings: {
      id: string;
      stakeholderId: string;
      stakeholderName: string;
      securityClassId: string;
      securityClassName: string;
      securityType: ScenarioInput["baseline"]["holdings"][number]["securityType"];
      shareCount: string;
      status: ScenarioInput["baseline"]["holdings"][number]["status"];
      pricePaidPerShare: string | null;
      issueDate: string | null;
    }[];
    optionGrants: {
      id: string;
      stakeholderId: string;
      stakeholderName: string;
      optionCount: string;
      exercisedCount: string;
      cancelledCount: string;
      status: ScenarioInput["baseline"]["optionGrants"][number]["status"];
      strikePrice: string;
      grantDate: string;
    }[];
    safes: {
      id: string;
      stakeholderId: string;
      stakeholderName: string;
      issueDate: string;
      purchaseAmount: string;
      valuationCap: string | null;
      discountPercent: string | null;
      mfn: boolean;
      postMoney: boolean;
      status: ScenarioInput["baseline"]["safes"][number]["status"];
      label: string;
    }[];
    notes: {
      id: string;
      stakeholderId: string;
      stakeholderName: string;
      issueDate: string;
      maturityDate: string | null;
      principal: string;
      annualInterestRatePercent: string;
      interestType: ScenarioInput["baseline"]["notes"][number]["interestType"];
      compoundingFrequencyPerYear: number | null;
      valuationCap: string | null;
      discountPercent: string | null;
      mfn: boolean;
      status: ScenarioInput["baseline"]["notes"][number]["status"];
      label: string;
    }[];
    reservedUngrantedPool: string;
  };
}

export async function loadSerializedBaseline(companyId: string): Promise<SerializedBaseline | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      securityClasses: true,
      holdings: { include: { stakeholder: true, securityClass: true } },
      optionGrants: { include: { stakeholder: true } },
      safes: { include: { stakeholder: true } },
      notes: { include: { stakeholder: true } },
    },
  });
  if (!company) return null;

  const reservedPool = company.securityClasses
    .filter((s) => s.type === "OPTION_POOL")
    .reduce((acc, s) => acc + (s.reservedUngrantedShares ?? 0n), 0n);

  return {
    companyName: company.legalName,
    authorizedCommonShares: company.authorizedCommonShares.toString(),
    authorizedPreferredShares: company.authorizedPreferredShares.toString(),
    baseline: {
      reservedUngrantedPool: reservedPool.toString(),
      holdings: company.holdings.map((h) => ({
        id: h.id,
        stakeholderId: h.stakeholderId,
        stakeholderName: h.stakeholder.name,
        securityClassId: h.securityClassId,
        securityClassName: h.securityClass.name,
        securityType: h.securityClass.type as SerializedBaseline["baseline"]["holdings"][number]["securityType"],
        shareCount: h.shareCount.toString(),
        status: h.status,
        pricePaidPerShare: h.pricePaidPerShare?.toString() ?? null,
        issueDate: h.issueDate?.toISOString() ?? null,
      })),
      optionGrants: company.optionGrants.map((g) => ({
        id: g.id,
        stakeholderId: g.stakeholderId,
        stakeholderName: g.stakeholder.name,
        optionCount: g.optionCount.toString(),
        exercisedCount: g.exercisedCount.toString(),
        cancelledCount: g.cancelledCount.toString(),
        status: g.status,
        strikePrice: g.strikePrice.toString(),
        grantDate: g.grantDate.toISOString(),
      })),
      safes: company.safes.map((s) => ({
        id: s.id,
        stakeholderId: s.stakeholderId,
        stakeholderName: s.stakeholder.name,
        issueDate: s.issueDate.toISOString(),
        purchaseAmount: s.purchaseAmount.toString(),
        valuationCap: s.valuationCap?.toString() ?? null,
        discountPercent: s.discountPercent?.toString() ?? null,
        mfn: s.mfn,
        postMoney: s.postMoney,
        status: s.status,
        label: `SAFE (${s.valuationCap ? "cap" : ""}${s.discountPercent ? "+discount" : ""}${s.mfn ? "+MFN" : ""})`,
      })),
      notes: company.notes.map((n) => ({
        id: n.id,
        stakeholderId: n.stakeholderId,
        stakeholderName: n.stakeholder.name,
        issueDate: n.issueDate.toISOString(),
        maturityDate: n.maturityDate?.toISOString() ?? null,
        principal: n.principal.toString(),
        annualInterestRatePercent: n.annualInterestRatePercent.toString(),
        interestType: n.interestType,
        compoundingFrequencyPerYear: n.compoundingFrequencyPerYear,
        valuationCap: n.valuationCap?.toString() ?? null,
        discountPercent: n.discountPercent?.toString() ?? null,
        mfn: n.mfn,
        status: n.status,
        label: "Note",
      })),
    },
  };
}
