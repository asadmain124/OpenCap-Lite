import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { toApiError } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        stakeholders: true,
        securityClasses: true,
        holdings: true,
        optionGrants: true,
        safes: true,
        notes: true,
      },
    });

    const zip = new JSZip();

    const manifest = {
      file_type: "OCF_MANIFEST_FILE",
      ocf_version: "1.2.0",
      issuer: {
        id: company.id,
        legal_name: company.legalName,
        country_of_formation: company.jurisdiction,
        initial_shares_authorized: company.authorizedCommonShares.toString(),
      },
      generated_by: "OpenCap Lite",
    };
    zip.file("Manifest.ocf.json", JSON.stringify(manifest, null, 2));

    const stakeholders = company.stakeholders.map((s) => ({
      id: s.id,
      object_type: "STAKEHOLDER",
      name: { legal_name: s.name },
      stakeholder_type:
        s.type === "ACCELERATOR" || s.type === "VC" ? "INSTITUTION" : "INDIVIDUAL",
      current_relationship: s.type,
      primary_contact: s.email ? { email_address: s.email } : undefined,
    }));
    zip.file("Stakeholders.ocf.json", JSON.stringify(stakeholders, null, 2));

    const stockClasses = company.securityClasses.map((c) => ({
      id: c.id,
      object_type: "STOCK_CLASS",
      name: c.name,
      class_type: c.type,
      seniority: c.seniorityOrder,
      initial_shares_authorized: c.authorizedShares?.toString() ?? "0",
      liquidation_preference_multiple:
        c.liquidationPreferenceMultiple?.toString() ?? null,
    }));
    zip.file("StockClasses.ocf.json", JSON.stringify(stockClasses, null, 2));

    const issuances = [
      ...company.holdings.map((h) => ({
        id: h.id,
        object_type: "TX_STOCK_ISSUANCE",
        stakeholder_id: h.stakeholderId,
        stock_class_id: h.securityClassId,
        quantity: h.shareCount.toString(),
        share_price: h.pricePaidPerShare
          ? { amount: h.pricePaidPerShare.toString(), currency: company.defaultCurrency }
          : undefined,
        date: h.issueDate.toISOString().slice(0, 10),
      })),
      ...company.optionGrants.map((g) => ({
        id: g.id,
        object_type: "TX_EQUITY_COMPENSATION_ISSUANCE",
        stakeholder_id: g.stakeholderId,
        quantity: g.optionCount.toString(),
        share_price: { amount: g.strikePrice.toString(), currency: company.defaultCurrency },
        date: g.grantDate.toISOString().slice(0, 10),
        option_grant_type: "OPTION",
      })),
    ];
    zip.file("Issuances.ocf.json", JSON.stringify(issuances, null, 2));

    const transactions = [
      ...company.safes.map((s) => ({
        id: s.id,
        object_type: "TX_CONVERTIBLE_ISSUANCE",
        stakeholder_id: s.stakeholderId,
        convertible_type: "SAFE",
        investment_amount: { amount: s.purchaseAmount.toString(), currency: s.currency },
        conversion_triggers: [
          {
            type: "AUTO_CONVERSION",
            valuation_cap: s.valuationCap?.toString() ?? null,
            discount: s.discountPercent?.toString() ?? null,
            mfn: s.mfn,
            post_money: s.postMoney,
          },
        ],
        date: s.issueDate.toISOString().slice(0, 10),
      })),
      ...company.notes.map((n) => ({
        id: n.id,
        object_type: "TX_CONVERTIBLE_ISSUANCE",
        stakeholder_id: n.stakeholderId,
        convertible_type: "NOTE",
        investment_amount: { amount: n.principal.toString(), currency: n.currency },
        interest_rate: {
          rate: n.annualInterestRatePercent.toString(),
          accrual_type: n.interestType,
          compounding_frequency_per_year: n.compoundingFrequencyPerYear,
        },
        conversion_triggers: [
          {
            type: "AUTO_CONVERSION",
            valuation_cap: n.valuationCap?.toString() ?? null,
            discount: n.discountPercent?.toString() ?? null,
            mfn: n.mfn,
          },
        ],
        date: n.issueDate.toISOString().slice(0, 10),
        maturity_date: n.maturityDate?.toISOString().slice(0, 10) ?? null,
      })),
    ];
    zip.file("Transactions.ocf.json", JSON.stringify(transactions, null, 2));

    const buf = await zip.generateAsync({ type: "uint8array" });
    // Copy into a plain ArrayBuffer to satisfy NextResponse BodyInit in Node/TS lib.
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return new NextResponse(ab, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="opencaplite-${company.id}-ocf.zip"`,
      },
    });
  } catch (e) {
    return toApiError(e);
  }
}
