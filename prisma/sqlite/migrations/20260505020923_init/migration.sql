-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalName" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "incorporationDate" DATETIME,
    "authorizedCommonShares" BIGINT NOT NULL DEFAULT 0,
    "authorizedPreferredShares" BIGINT NOT NULL DEFAULT 0,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Stakeholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stakeholder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "seniorityOrder" INTEGER NOT NULL DEFAULT 0,
    "authorizedShares" BIGINT,
    "liquidationPreferenceMultiple" DECIMAL,
    "participationRights" BOOLEAN NOT NULL DEFAULT false,
    "reservedUngrantedShares" BIGINT DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecurityClass_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquityHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "securityClassId" TEXT NOT NULL,
    "shareCount" BIGINT NOT NULL,
    "pricePaidPerShare" DECIMAL,
    "issueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "vestingStartDate" DATETIME,
    "vestingCliffMonths" INTEGER,
    "vestingDurationMonths" INTEGER,
    "vestingFrequency" TEXT NOT NULL DEFAULT 'NONE',
    "certificateNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquityHolding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquityHolding_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquityHolding_securityClassId_fkey" FOREIGN KEY ("securityClassId") REFERENCES "SecurityClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OptionGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "optionCount" BIGINT NOT NULL,
    "exercisedCount" BIGINT NOT NULL DEFAULT 0,
    "cancelledCount" BIGINT NOT NULL DEFAULT 0,
    "strikePrice" DECIMAL NOT NULL,
    "grantDate" DATETIME NOT NULL,
    "expirationDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "vestingStartDate" DATETIME,
    "vestingCliffMonths" INTEGER,
    "vestingDurationMonths" INTEGER,
    "vestingFrequency" TEXT NOT NULL DEFAULT 'NONE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OptionGrant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OptionGrant_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SAFEInstrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "purchaseAmount" DECIMAL NOT NULL,
    "valuationCap" DECIMAL,
    "discountPercent" DECIMAL,
    "mfn" BOOLEAN NOT NULL DEFAULT false,
    "postMoney" BOOLEAN NOT NULL DEFAULT true,
    "proRataRights" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OUTSTANDING',
    "sideLetterNotes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SAFEInstrument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SAFEInstrument_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConvertibleNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "maturityDate" DATETIME,
    "principal" DECIMAL NOT NULL,
    "annualInterestRatePercent" DECIMAL NOT NULL DEFAULT 0,
    "interestType" TEXT NOT NULL DEFAULT 'SIMPLE',
    "compoundingFrequencyPerYear" INTEGER,
    "valuationCap" DECIMAL,
    "discountPercent" DECIMAL,
    "mfn" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OUTSTANDING',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConvertibleNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConvertibleNote_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baselineMode" TEXT NOT NULL DEFAULT 'LIVE_CAP_TABLE',
    "snapshotJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scenario_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScenarioRoundInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "roundType" TEXT NOT NULL DEFAULT 'PRICED_ROUND',
    "preMoneyValuation" DECIMAL,
    "newMoney" DECIMAL,
    "pricedRoundPricePerShareOverride" DECIMAL,
    "roundCloseDate" DATETIME,
    "optionPoolTopUpMode" TEXT NOT NULL DEFAULT 'NONE',
    "optionPoolTargetPercent" DECIMAL,
    "optionPoolFixedShares" BIGINT,
    "optionPoolFixedPercentPreMoney" DECIMAL,
    "capDenominatorMethod" TEXT NOT NULL DEFAULT 'CURRENT_FULLY_DILUTED',
    "capDenominatorOverride" BIGINT,
    "preMoneyDenominatorMethod" TEXT NOT NULL DEFAULT 'CURRENT_FULLY_DILUTED',
    "preMoneyDenominatorOverride" BIGINT,
    "conversionOrderingRule" TEXT NOT NULL DEFAULT 'CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY',
    "notesConvertUsing" TEXT NOT NULL DEFAULT 'BEST_FOR_INVESTOR',
    "safesConvertUsing" TEXT NOT NULL DEFAULT 'BEST_FOR_INVESTOR',
    "mfnFallback" TEXT,
    "includeProRata" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScenarioRoundInput_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScenarioNewInstrumentInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScenarioNewInstrumentInput_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "actor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
