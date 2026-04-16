import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { prisma } from "@/lib/prisma";
import { toApiError, ok } from "@/lib/api/response";
import manifestSchema from "../../../../../../../vendor/ocf-schemas/manifest.schema.json";
import stakeholderSchema from "../../../../../../../vendor/ocf-schemas/stakeholder.schema.json";
import stockClassSchema from "../../../../../../../vendor/ocf-schemas/stock-class.schema.json";
import issuanceSchema from "../../../../../../../vendor/ocf-schemas/issuance.schema.json";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

interface ManifestFile {
  issuer: { legal_name: string; country_of_formation?: string };
}

interface StakeholderFile {
  id: string;
  name?: { legal_name?: string };
  stakeholder_type?: string;
  current_relationship?: string;
  primary_contact?: { email_address?: string };
}

interface StockClassFile {
  id: string;
  name: string;
  class_type: string;
  seniority?: number;
  initial_shares_authorized?: string;
}

interface IssuanceFile {
  id: string;
  object_type: string;
  stakeholder_id: string;
  stock_class_id?: string;
  quantity?: string;
  share_price?: { amount?: string };
  date?: string;
  convertible_type?: string;
  investment_amount?: { amount?: string };
  conversion_triggers?: {
    valuation_cap?: string | null;
    discount?: string | null;
    mfn?: boolean;
    post_money?: boolean;
  }[];
  interest_rate?: { rate?: string; accrual_type?: string; compounding_frequency_per_year?: number | null };
  maturity_date?: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const mode = req.nextUrl.searchParams.get("mode") === "overwrite" ? "overwrite" : "merge";
    const contentType = req.headers.get("content-type") ?? "";
    let buf: Buffer;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Missing 'file' field", code: "MISSING_FILE" },
          { status: 400 },
        );
      }
      buf = Buffer.from(await file.arrayBuffer());
    } else {
      buf = Buffer.from(await req.arrayBuffer());
    }

    const zip = await JSZip.loadAsync(buf);
    const readJson = async <T>(name: string): Promise<T | null> => {
      const f = zip.file(name);
      if (!f) return null;
      const text = await f.async("string");
      return JSON.parse(text) as T;
    };

    const warnings: string[] = [];
    const errors: string[] = [];

    const manifest = await readJson<ManifestFile>("Manifest.ocf.json");
    if (!manifest) {
      return NextResponse.json(
        { error: "OCF zip missing Manifest.ocf.json", code: "OCF_MISSING_MANIFEST" },
        { status: 400 },
      );
    }
    if (!ajv.validate(manifestSchema, manifest)) {
      warnings.push(`Manifest: ${ajv.errorsText(ajv.errors)}`);
    }

    const stakeholderRaw = (await readJson<StakeholderFile[]>("Stakeholders.ocf.json")) ?? [];
    const stockClassRaw = (await readJson<StockClassFile[]>("StockClasses.ocf.json")) ?? [];
    const issuancesRaw = (await readJson<IssuanceFile[]>("Issuances.ocf.json")) ?? [];
    const transactionsRaw = (await readJson<IssuanceFile[]>("Transactions.ocf.json")) ?? [];

    if (!ajv.validate(stakeholderSchema, stakeholderRaw))
      warnings.push(`Stakeholders: ${ajv.errorsText(ajv.errors)}`);
    if (!ajv.validate(stockClassSchema, stockClassRaw))
      warnings.push(`StockClasses: ${ajv.errorsText(ajv.errors)}`);
    if (!ajv.validate(issuanceSchema, issuancesRaw))
      warnings.push(`Issuances: ${ajv.errorsText(ajv.errors)}`);

    const created = { stakeholders: 0, securityClasses: 0, holdings: 0, optionGrants: 0, safes: 0, notes: 0 };

    const companyId = params.id;

    const result = await prisma.$transaction(async (tx) => {
      if (mode === "overwrite") {
        await tx.scenarioNewInstrumentInput.deleteMany({ where: { scenario: { companyId } } });
        await tx.scenarioRoundInput.deleteMany({ where: { scenario: { companyId } } });
        await tx.scenario.deleteMany({ where: { companyId } });
        await tx.convertibleNote.deleteMany({ where: { companyId } });
        await tx.sAFEInstrument.deleteMany({ where: { companyId } });
        await tx.optionGrant.deleteMany({ where: { companyId } });
        await tx.equityHolding.deleteMany({ where: { companyId } });
        await tx.securityClass.deleteMany({ where: { companyId } });
        await tx.stakeholder.deleteMany({ where: { companyId } });
      }

      const stakeholderMap = new Map<string, string>();
      for (const s of stakeholderRaw) {
        try {
          const name = s.name?.legal_name ?? "Unknown";
          const relationship = (s.current_relationship ?? "OTHER").toUpperCase();
          const mappedType = [
            "FOUNDER",
            "EMPLOYEE",
            "ADVISOR",
            "ANGEL",
            "VC",
            "ACCELERATOR",
            "OTHER",
          ].includes(relationship)
            ? (relationship as "FOUNDER" | "EMPLOYEE" | "ADVISOR" | "ANGEL" | "VC" | "ACCELERATOR" | "OTHER")
            : "OTHER";
          const row = await tx.stakeholder.create({
            data: {
              companyId,
              name,
              type: mappedType,
              email: s.primary_contact?.email_address ?? null,
            },
          });
          stakeholderMap.set(s.id, row.id);
          created.stakeholders++;
        } catch (err) {
          errors.push(`Stakeholder ${s.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const stockClassMap = new Map<string, string>();
      for (const c of stockClassRaw) {
        try {
          const validType = [
            "COMMON",
            "PREFERRED",
            "OPTION_POOL",
            "WARRANT",
            "LLC_UNIT",
            "OTHER",
          ].includes(c.class_type)
            ? (c.class_type as "COMMON" | "PREFERRED" | "OPTION_POOL" | "WARRANT" | "LLC_UNIT" | "OTHER")
            : "OTHER";
          const row = await tx.securityClass.create({
            data: {
              companyId,
              name: c.name,
              type: validType,
              seniorityOrder: c.seniority ?? 0,
              authorizedShares: c.initial_shares_authorized ? BigInt(c.initial_shares_authorized) : null,
            },
          });
          stockClassMap.set(c.id, row.id);
          created.securityClasses++;
        } catch (err) {
          errors.push(`StockClass ${c.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (const iss of issuancesRaw) {
        try {
          const stakeholderId = stakeholderMap.get(iss.stakeholder_id);
          if (!stakeholderId) {
            warnings.push(`Issuance ${iss.id}: unknown stakeholder reference`);
            continue;
          }
          if (iss.object_type === "TX_STOCK_ISSUANCE") {
            const stockClassId = iss.stock_class_id ? stockClassMap.get(iss.stock_class_id) : null;
            if (!stockClassId) {
              warnings.push(`Issuance ${iss.id}: unknown stock class`);
              continue;
            }
            await tx.equityHolding.create({
              data: {
                companyId,
                stakeholderId,
                securityClassId: stockClassId,
                shareCount: BigInt(iss.quantity ?? "0"),
                pricePaidPerShare: iss.share_price?.amount ?? null,
                issueDate: iss.date ? new Date(iss.date) : new Date(),
                status: "ACTIVE",
              },
            });
            created.holdings++;
          } else if (iss.object_type === "TX_EQUITY_COMPENSATION_ISSUANCE") {
            await tx.optionGrant.create({
              data: {
                companyId,
                stakeholderId,
                optionCount: BigInt(iss.quantity ?? "0"),
                strikePrice: iss.share_price?.amount ?? "0",
                grantDate: iss.date ? new Date(iss.date) : new Date(),
                status: "ACTIVE",
              },
            });
            created.optionGrants++;
          }
        } catch (err) {
          errors.push(`Issuance ${iss.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (const tx_ of transactionsRaw) {
        try {
          const stakeholderId = stakeholderMap.get(tx_.stakeholder_id);
          if (!stakeholderId) {
            warnings.push(`Transaction ${tx_.id}: unknown stakeholder reference`);
            continue;
          }
          const trigger = tx_.conversion_triggers?.[0];
          if (tx_.convertible_type === "SAFE") {
            await tx.sAFEInstrument.create({
              data: {
                companyId,
                stakeholderId,
                issueDate: tx_.date ? new Date(tx_.date) : new Date(),
                purchaseAmount: tx_.investment_amount?.amount ?? "0",
                valuationCap: trigger?.valuation_cap ?? null,
                discountPercent: trigger?.discount ?? null,
                mfn: trigger?.mfn ?? false,
                postMoney: trigger?.post_money ?? true,
                status: "OUTSTANDING",
              },
            });
            created.safes++;
          } else if (tx_.convertible_type === "NOTE") {
            const accrualType = tx_.interest_rate?.accrual_type === "COMPOUND" ? "COMPOUND" : "SIMPLE";
            await tx.convertibleNote.create({
              data: {
                companyId,
                stakeholderId,
                issueDate: tx_.date ? new Date(tx_.date) : new Date(),
                maturityDate: tx_.maturity_date ? new Date(tx_.maturity_date) : null,
                principal: tx_.investment_amount?.amount ?? "0",
                annualInterestRatePercent: tx_.interest_rate?.rate ?? "0",
                interestType: accrualType,
                compoundingFrequencyPerYear: tx_.interest_rate?.compounding_frequency_per_year ?? null,
                valuationCap: trigger?.valuation_cap ?? null,
                discountPercent: trigger?.discount ?? null,
                mfn: trigger?.mfn ?? false,
                status: "OUTSTANDING",
              },
            });
            created.notes++;
          }
        } catch (err) {
          errors.push(`Transaction ${tx_.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return { created, warnings, errors };
    });

    return ok(result);
  } catch (e) {
    return toApiError(e);
  }
}
