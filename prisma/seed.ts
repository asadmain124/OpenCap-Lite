/**
 * OpenCap Lite — Seed Script
 *
 * Creates the "Acme Labs, Inc." demo company described in PRD §15.
 *
 * Idempotent: running multiple times clears prior Acme data (respecting FK order)
 * before re-inserting. Uses a single $transaction for atomicity.
 */

import { Prisma, PrismaClient } from "@prisma/client";

import { isSqliteUrl, sqliteJsonExtension } from "../src/lib/prisma-extensions";

const basePrisma = new PrismaClient();
const prisma = isSqliteUrl(process.env.DATABASE_URL)
  ? basePrisma.$extends(sqliteJsonExtension)
  : basePrisma;

const COMPANY_NAME = "Acme Labs, Inc.";

async function main(): Promise<void> {
  console.log(`Seeding OpenCap Lite demo data for "${COMPANY_NAME}"...`);

  await prisma.$transaction(async (tx) => {
    // --- 1. Clear existing Acme data (respect FK order) -------------------
    const existing = await tx.company.findMany({
      where: { legalName: COMPANY_NAME },
      select: { id: true },
    });

    for (const { id: companyId } of existing) {
      // scenarios → (cascades to ScenarioRoundInput, ScenarioNewInstrumentInput)
      await tx.scenario.deleteMany({ where: { companyId } });
      // notes
      await tx.convertibleNote.deleteMany({ where: { companyId } });
      // safes
      await tx.sAFEInstrument.deleteMany({ where: { companyId } });
      // option grants
      await tx.optionGrant.deleteMany({ where: { companyId } });
      // holdings
      await tx.equityHolding.deleteMany({ where: { companyId } });
      // security classes
      await tx.securityClass.deleteMany({ where: { companyId } });
      // stakeholders
      await tx.stakeholder.deleteMany({ where: { companyId } });
      // audit logs (just in case — schema keeps these around)
      await tx.auditLog.deleteMany({ where: { companyId } });
      // finally the company itself
      await tx.company.delete({ where: { id: companyId } });
    }

    // --- 2. Company ------------------------------------------------------
    const incorporationDate = new Date("2025-01-15T00:00:00.000Z");

    const company = await tx.company.create({
      data: {
        legalName: COMPANY_NAME,
        jurisdiction: "Delaware",
        incorporationDate,
        authorizedCommonShares: 20_000_000n,
        authorizedPreferredShares: 10_000_000n,
        defaultCurrency: "USD",
      },
    });

    // --- 3. Security Classes --------------------------------------------
    const commonClass = await tx.securityClass.create({
      data: {
        companyId: company.id,
        name: "Common Stock",
        type: "COMMON",
        seniorityOrder: 0,
        authorizedShares: 20_000_000n,
        participationRights: false,
      },
    });

    const optionPoolClass = await tx.securityClass.create({
      data: {
        companyId: company.id,
        name: "2025 Equity Plan",
        type: "OPTION_POOL",
        seniorityOrder: 0,
        reservedUngrantedShares: 2_000_000n,
        participationRights: false,
      },
    });

    const seedPreferredClass = await tx.securityClass.create({
      data: {
        companyId: company.id,
        name: "Seed Preferred",
        type: "PREFERRED",
        seniorityOrder: 1,
        authorizedShares: 10_000_000n,
        liquidationPreferenceMultiple: new Prisma.Decimal("1.0000"),
        participationRights: false, // 1x non-participating
      },
    });

    // --- 4. Stakeholders ------------------------------------------------
    const alex = await tx.stakeholder.create({
      data: {
        companyId: company.id,
        type: "FOUNDER",
        name: "Alex Founder",
      },
    });

    const jamie = await tx.stakeholder.create({
      data: {
        companyId: company.id,
        type: "FOUNDER",
        name: "Jamie Founder",
      },
    });

    const jordan = await tx.stakeholder.create({
      data: {
        companyId: company.id,
        type: "EMPLOYEE",
        name: "Jordan Employee",
      },
    });

    const riley = await tx.stakeholder.create({
      data: {
        companyId: company.id,
        type: "ADVISOR",
        name: "Riley Advisor",
      },
    });

    const morgan = await tx.stakeholder.create({
      data: {
        companyId: company.id,
        type: "ANGEL",
        name: "Morgan Angel",
      },
    });

    const safeVcA = await tx.stakeholder.create({
      data: {
        companyId: company.id,
        type: "VC",
        name: "SAFE VC A",
      },
    });

    const safeVcB = await tx.stakeholder.create({
      data: {
        companyId: company.id,
        type: "VC",
        name: "SAFE VC B",
      },
    });

    const noteVcC = await tx.stakeholder.create({
      data: {
        companyId: company.id,
        type: "VC",
        name: "Note VC C",
      },
    });

    // --- 5. Founder holdings (8M common each, 4yr/1yr cliff) -----------
    const founderPrice = new Prisma.Decimal("0.0001");

    for (const founder of [alex, jamie]) {
      await tx.equityHolding.create({
        data: {
          companyId: company.id,
          stakeholderId: founder.id,
          securityClassId: commonClass.id,
          shareCount: 8_000_000n,
          pricePaidPerShare: founderPrice,
          issueDate: incorporationDate,
          status: "ACTIVE",
          vestingStartDate: incorporationDate,
          vestingCliffMonths: 12,
          vestingDurationMonths: 48,
          vestingFrequency: "MONTHLY",
        },
      });
    }

    // --- 6. Angel preferred holding ------------------------------------
    await tx.equityHolding.create({
      data: {
        companyId: company.id,
        stakeholderId: morgan.id,
        securityClassId: seedPreferredClass.id,
        shareCount: 1_000_000n,
        pricePaidPerShare: new Prisma.Decimal("1.00000000"),
        issueDate: new Date("2025-03-01T00:00:00.000Z"),
        status: "ACTIVE",
        vestingFrequency: "NONE",
      },
    });

    // --- 7. Option grants ----------------------------------------------
    await tx.optionGrant.create({
      data: {
        companyId: company.id,
        stakeholderId: jordan.id,
        optionCount: 100_000n,
        strikePrice: new Prisma.Decimal("0.10000000"),
        grantDate: new Date("2025-04-01T00:00:00.000Z"),
        status: "ACTIVE",
        vestingStartDate: new Date("2025-04-01T00:00:00.000Z"),
        vestingCliffMonths: 12,
        vestingDurationMonths: 48,
        vestingFrequency: "MONTHLY",
      },
    });

    await tx.optionGrant.create({
      data: {
        companyId: company.id,
        stakeholderId: riley.id,
        optionCount: 25_000n,
        strikePrice: new Prisma.Decimal("0.10000000"),
        grantDate: new Date("2025-04-01T00:00:00.000Z"),
        status: "ACTIVE",
        vestingStartDate: new Date("2025-04-01T00:00:00.000Z"),
        vestingCliffMonths: 0, // no cliff
        vestingDurationMonths: 24,
        vestingFrequency: "MONTHLY",
      },
    });

    // --- 8. SAFEs ------------------------------------------------------
    // SAFE A: cap-only $10M, post-money, $500K, 2025-06-15
    await tx.sAFEInstrument.create({
      data: {
        companyId: company.id,
        stakeholderId: safeVcA.id,
        issueDate: new Date("2025-06-15T00:00:00.000Z"),
        purchaseAmount: new Prisma.Decimal("500000.00"),
        valuationCap: new Prisma.Decimal("10000000.00"),
        discountPercent: null, // cap-only: discount must be null
        mfn: false,
        postMoney: true,
        proRataRights: false,
        status: "OUTSTANDING",
        currency: "USD",
      },
    });

    // SAFE B: cap $12M + 20% discount, post-money, $250K, 2025-09-01
    await tx.sAFEInstrument.create({
      data: {
        companyId: company.id,
        stakeholderId: safeVcB.id,
        issueDate: new Date("2025-09-01T00:00:00.000Z"),
        purchaseAmount: new Prisma.Decimal("250000.00"),
        valuationCap: new Prisma.Decimal("12000000.00"),
        discountPercent: new Prisma.Decimal("20.0000"),
        mfn: false,
        postMoney: true,
        proRataRights: false,
        status: "OUTSTANDING",
        currency: "USD",
      },
    });

    // --- 9. Convertible Note --------------------------------------------
    await tx.convertibleNote.create({
      data: {
        companyId: company.id,
        stakeholderId: noteVcC.id,
        issueDate: new Date("2025-07-01T00:00:00.000Z"),
        maturityDate: new Date("2027-07-01T00:00:00.000Z"), // +24 months
        principal: new Prisma.Decimal("250000.00"),
        annualInterestRatePercent: new Prisma.Decimal("6.0000"),
        interestType: "SIMPLE",
        compoundingFrequencyPerYear: null,
        valuationCap: new Prisma.Decimal("15000000.00"),
        discountPercent: null,
        mfn: false,
        status: "OUTSTANDING",
        currency: "USD",
      },
    });

    // --- 10. Scenarios --------------------------------------------------

    // Scenario 1: $750K SAFE bridge
    const scenario1 = await tx.scenario.create({
      data: {
        companyId: company.id,
        name: "$750K SAFE bridge",
        description:
          "New $750K post-money SAFE at $10M cap to bridge to a priced seed.",
        baselineMode: "LIVE_CAP_TABLE",
      },
    });

    await tx.scenarioRoundInput.create({
      data: {
        scenarioId: scenario1.id,
        roundType: "NEW_SAFE",
        roundCloseDate: new Date("2026-03-01T00:00:00.000Z"),
        optionPoolTopUpMode: "NONE",
        capDenominatorMethod: "CURRENT_FULLY_DILUTED",
        preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED",
        conversionOrderingRule: "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
        notesConvertUsing: "BEST_FOR_INVESTOR",
        safesConvertUsing: "BEST_FOR_INVESTOR",
        includeProRata: false,
      },
    });

    await tx.scenarioNewInstrumentInput.create({
      data: {
        scenarioId: scenario1.id,
        type: "NEW_SAFE",
        label: "Bridge SAFE",
        notesJson: {
          stakeholderName: "Bridge SAFE Investor",
          purchaseAmount: "750000",
          valuationCap: "10000000",
          discountPercent: null,
          postMoney: true,
          mfn: false,
          issueDate: "2026-03-01",
        },
      },
    });

    // Scenario 2: $2M seed priced round with 10% pool top-up
    const scenario2 = await tx.scenario.create({
      data: {
        companyId: company.id,
        name: "$2M seed priced round with 10% pool top-up",
        description:
          "$2M at $8M pre-money, pool topped up to 10% of post-money fully diluted.",
        baselineMode: "LIVE_CAP_TABLE",
      },
    });

    await tx.scenarioRoundInput.create({
      data: {
        scenarioId: scenario2.id,
        roundType: "PRICED_ROUND",
        preMoneyValuation: new Prisma.Decimal("8000000.00"),
        newMoney: new Prisma.Decimal("2000000.00"),
        roundCloseDate: new Date("2026-06-01T00:00:00.000Z"),
        optionPoolTopUpMode: "TO_TARGET_POST_MONEY_PERCENT",
        optionPoolTargetPercent: new Prisma.Decimal("10.0000"),
        capDenominatorMethod: "CURRENT_FULLY_DILUTED",
        preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED",
        conversionOrderingRule: "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
        notesConvertUsing: "BEST_FOR_INVESTOR",
        safesConvertUsing: "BEST_FOR_INVESTOR",
        includeProRata: false,
      },
    });

    await tx.scenarioNewInstrumentInput.create({
      data: {
        scenarioId: scenario2.id,
        type: "NEW_EQUITY",
        label: "Lead Investor",
        notesJson: {
          stakeholderName: "Seed Lead Investor",
          investmentAmount: "2000000",
          issueDate: "2026-06-01",
        },
      },
    });

    // Scenario 3: Accelerator 7% fixed equity vs equivalent SAFE
    const scenario3 = await tx.scenario.create({
      data: {
        companyId: company.id,
        name: "Accelerator 7% fixed equity vs equivalent SAFE",
        description:
          "Compare a 7% fixed-equity accelerator grant against an equivalent SAFE.",
        baselineMode: "LIVE_CAP_TABLE",
      },
    });

    await tx.scenarioRoundInput.create({
      data: {
        scenarioId: scenario3.id,
        roundType: "ACCELERATOR_EQUITY",
        roundCloseDate: new Date("2026-02-01T00:00:00.000Z"),
        optionPoolTopUpMode: "NONE",
        capDenominatorMethod: "CURRENT_FULLY_DILUTED",
        preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED",
        conversionOrderingRule: "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
        notesConvertUsing: "BEST_FOR_INVESTOR",
        safesConvertUsing: "BEST_FOR_INVESTOR",
        includeProRata: false,
      },
    });

    await tx.scenarioNewInstrumentInput.create({
      data: {
        scenarioId: scenario3.id,
        type: "NEW_ACCELERATOR_EQUITY",
        label: "Accelerator 7% Fixed Equity",
        notesJson: {
          stakeholderName: "Accelerator Program",
          targetEquityPercent: "7",
          issueDate: "2026-02-01",
        },
      },
    });

    console.log(`  - Company: ${company.legalName} (${company.id})`);
    console.log(`  - 3 SecurityClasses, 8 Stakeholders`);
    console.log(`  - 3 EquityHoldings, 2 OptionGrants`);
    console.log(`  - 2 SAFEs, 1 ConvertibleNote`);
    console.log(`  - 3 Scenarios (with RoundInputs + NewInstrumentInputs)`);
  });

  console.log("Seed complete.");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
