-- CreateEnum
CREATE TYPE "StakeholderType" AS ENUM ('FOUNDER', 'EMPLOYEE', 'ADVISOR', 'ANGEL', 'VC', 'ACCELERATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "SecurityType" AS ENUM ('COMMON', 'PREFERRED', 'OPTION_POOL', 'WARRANT', 'LLC_UNIT', 'OTHER');

-- CreateEnum
CREATE TYPE "HoldingStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'REPURCHASED');

-- CreateEnum
CREATE TYPE "VestingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'NONE');

-- CreateEnum
CREATE TYPE "OptionGrantStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SAFEStatus" AS ENUM ('OUTSTANDING', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('OUTSTANDING', 'CONVERTED', 'REPAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterestType" AS ENUM ('SIMPLE', 'COMPOUND');

-- CreateEnum
CREATE TYPE "BaselineMode" AS ENUM ('LIVE_CAP_TABLE', 'SNAPSHOT');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('PRICED_ROUND', 'NEW_SAFE', 'NEW_NOTE', 'ACCELERATOR_EQUITY', 'BRIDGE');

-- CreateEnum
CREATE TYPE "OptionPoolTopUpMode" AS ENUM ('NONE', 'TO_TARGET_POST_MONEY_PERCENT', 'FIXED_SHARES', 'FIXED_PERCENT_PRE_MONEY');

-- CreateEnum
CREATE TYPE "ConversionOrderingRule" AS ENUM ('NOTES_THEN_SAFES_THEN_NEW_MONEY', 'SAFES_THEN_NOTES_THEN_NEW_MONEY', 'CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY', 'POOL_TOPUP_THEN_CONVERTIBLES_THEN_NEW_MONEY', 'CUSTOM_SIMPLIFIED');

-- CreateEnum
CREATE TYPE "NotesConvertUsing" AS ENUM ('BEST_FOR_INVESTOR', 'CAP_ONLY', 'DISCOUNT_ONLY', 'USER_SELECTED_PER_NOTE');

-- CreateEnum
CREATE TYPE "SafesConvertUsing" AS ENUM ('BEST_FOR_INVESTOR', 'CAP_ONLY', 'DISCOUNT_ONLY', 'USER_SELECTED_PER_SAFE');

-- CreateEnum
CREATE TYPE "NewInstrumentType" AS ENUM ('NEW_SAFE', 'NEW_NOTE', 'NEW_EQUITY', 'NEW_ACCELERATOR_EQUITY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "CapDenominatorMethod" AS ENUM ('CURRENT_FULLY_DILUTED', 'FULLY_DILUTED_EXCLUDING_CONVERTIBLES', 'USER_OVERRIDE');

-- CreateEnum
CREATE TYPE "PreMoneyDenominatorMethod" AS ENUM ('CURRENT_FULLY_DILUTED', 'FULLY_DILUTED_EXCLUDING_CONVERTIBLES', 'USER_OVERRIDE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "incorporationDate" TIMESTAMP(3),
    "authorizedCommonShares" BIGINT NOT NULL DEFAULT 0,
    "authorizedPreferredShares" BIGINT NOT NULL DEFAULT 0,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stakeholder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "StakeholderType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityClass" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SecurityType" NOT NULL,
    "seniorityOrder" INTEGER NOT NULL DEFAULT 0,
    "authorizedShares" BIGINT,
    "liquidationPreferenceMultiple" DECIMAL(10,4),
    "participationRights" BOOLEAN NOT NULL DEFAULT false,
    "reservedUngrantedShares" BIGINT DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquityHolding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "securityClassId" TEXT NOT NULL,
    "shareCount" BIGINT NOT NULL,
    "pricePaidPerShare" DECIMAL(20,8),
    "issueDate" TIMESTAMP(3) NOT NULL,
    "status" "HoldingStatus" NOT NULL DEFAULT 'ACTIVE',
    "vestingStartDate" TIMESTAMP(3),
    "vestingCliffMonths" INTEGER,
    "vestingDurationMonths" INTEGER,
    "vestingFrequency" "VestingFrequency" NOT NULL DEFAULT 'NONE',
    "certificateNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquityHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionGrant" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "optionCount" BIGINT NOT NULL,
    "exercisedCount" BIGINT NOT NULL DEFAULT 0,
    "cancelledCount" BIGINT NOT NULL DEFAULT 0,
    "strikePrice" DECIMAL(20,8) NOT NULL,
    "grantDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "status" "OptionGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "vestingStartDate" TIMESTAMP(3),
    "vestingCliffMonths" INTEGER,
    "vestingDurationMonths" INTEGER,
    "vestingFrequency" "VestingFrequency" NOT NULL DEFAULT 'NONE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SAFEInstrument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "purchaseAmount" DECIMAL(20,2) NOT NULL,
    "valuationCap" DECIMAL(20,2),
    "discountPercent" DECIMAL(10,4),
    "mfn" BOOLEAN NOT NULL DEFAULT false,
    "postMoney" BOOLEAN NOT NULL DEFAULT true,
    "proRataRights" BOOLEAN NOT NULL DEFAULT false,
    "status" "SAFEStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "sideLetterNotes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SAFEInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvertibleNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3),
    "principal" DECIMAL(20,2) NOT NULL,
    "annualInterestRatePercent" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "interestType" "InterestType" NOT NULL DEFAULT 'SIMPLE',
    "compoundingFrequencyPerYear" INTEGER,
    "valuationCap" DECIMAL(20,2),
    "discountPercent" DECIMAL(10,4),
    "mfn" BOOLEAN NOT NULL DEFAULT false,
    "status" "NoteStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConvertibleNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baselineMode" "BaselineMode" NOT NULL DEFAULT 'LIVE_CAP_TABLE',
    "snapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioRoundInput" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "roundType" "RoundType" NOT NULL DEFAULT 'PRICED_ROUND',
    "preMoneyValuation" DECIMAL(20,2),
    "newMoney" DECIMAL(20,2),
    "pricedRoundPricePerShareOverride" DECIMAL(20,8),
    "roundCloseDate" TIMESTAMP(3),
    "optionPoolTopUpMode" "OptionPoolTopUpMode" NOT NULL DEFAULT 'NONE',
    "optionPoolTargetPercent" DECIMAL(10,4),
    "optionPoolFixedShares" BIGINT,
    "optionPoolFixedPercentPreMoney" DECIMAL(10,4),
    "capDenominatorMethod" "CapDenominatorMethod" NOT NULL DEFAULT 'CURRENT_FULLY_DILUTED',
    "capDenominatorOverride" BIGINT,
    "preMoneyDenominatorMethod" "PreMoneyDenominatorMethod" NOT NULL DEFAULT 'CURRENT_FULLY_DILUTED',
    "preMoneyDenominatorOverride" BIGINT,
    "conversionOrderingRule" "ConversionOrderingRule" NOT NULL DEFAULT 'CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY',
    "notesConvertUsing" "NotesConvertUsing" NOT NULL DEFAULT 'BEST_FOR_INVESTOR',
    "safesConvertUsing" "SafesConvertUsing" NOT NULL DEFAULT 'BEST_FOR_INVESTOR',
    "mfnFallback" TEXT,
    "includeProRata" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioRoundInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioNewInstrumentInput" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "type" "NewInstrumentType" NOT NULL,
    "label" TEXT NOT NULL,
    "notesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioNewInstrumentInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stakeholder_companyId_idx" ON "Stakeholder"("companyId");

-- CreateIndex
CREATE INDEX "SecurityClass_companyId_idx" ON "SecurityClass"("companyId");

-- CreateIndex
CREATE INDEX "EquityHolding_companyId_idx" ON "EquityHolding"("companyId");

-- CreateIndex
CREATE INDEX "EquityHolding_stakeholderId_idx" ON "EquityHolding"("stakeholderId");

-- CreateIndex
CREATE INDEX "OptionGrant_companyId_idx" ON "OptionGrant"("companyId");

-- CreateIndex
CREATE INDEX "OptionGrant_stakeholderId_idx" ON "OptionGrant"("stakeholderId");

-- CreateIndex
CREATE INDEX "SAFEInstrument_companyId_idx" ON "SAFEInstrument"("companyId");

-- CreateIndex
CREATE INDEX "SAFEInstrument_stakeholderId_idx" ON "SAFEInstrument"("stakeholderId");

-- CreateIndex
CREATE INDEX "ConvertibleNote_companyId_idx" ON "ConvertibleNote"("companyId");

-- CreateIndex
CREATE INDEX "ConvertibleNote_stakeholderId_idx" ON "ConvertibleNote"("stakeholderId");

-- CreateIndex
CREATE INDEX "Scenario_companyId_idx" ON "Scenario"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioRoundInput_scenarioId_key" ON "ScenarioRoundInput"("scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioNewInstrumentInput_scenarioId_idx" ON "ScenarioNewInstrumentInput"("scenarioId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Stakeholder" ADD CONSTRAINT "Stakeholder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityClass" ADD CONSTRAINT "SecurityClass_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityHolding" ADD CONSTRAINT "EquityHolding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityHolding" ADD CONSTRAINT "EquityHolding_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityHolding" ADD CONSTRAINT "EquityHolding_securityClassId_fkey" FOREIGN KEY ("securityClassId") REFERENCES "SecurityClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGrant" ADD CONSTRAINT "OptionGrant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGrant" ADD CONSTRAINT "OptionGrant_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAFEInstrument" ADD CONSTRAINT "SAFEInstrument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAFEInstrument" ADD CONSTRAINT "SAFEInstrument_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvertibleNote" ADD CONSTRAINT "ConvertibleNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvertibleNote" ADD CONSTRAINT "ConvertibleNote_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioRoundInput" ADD CONSTRAINT "ScenarioRoundInput_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioNewInstrumentInput" ADD CONSTRAINT "ScenarioNewInstrumentInput_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
