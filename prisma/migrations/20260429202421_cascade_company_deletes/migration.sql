-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ConvertibleNote" DROP CONSTRAINT "ConvertibleNote_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ConvertibleNote" DROP CONSTRAINT "ConvertibleNote_stakeholderId_fkey";

-- DropForeignKey
ALTER TABLE "EquityHolding" DROP CONSTRAINT "EquityHolding_companyId_fkey";

-- DropForeignKey
ALTER TABLE "EquityHolding" DROP CONSTRAINT "EquityHolding_securityClassId_fkey";

-- DropForeignKey
ALTER TABLE "EquityHolding" DROP CONSTRAINT "EquityHolding_stakeholderId_fkey";

-- DropForeignKey
ALTER TABLE "OptionGrant" DROP CONSTRAINT "OptionGrant_companyId_fkey";

-- DropForeignKey
ALTER TABLE "OptionGrant" DROP CONSTRAINT "OptionGrant_stakeholderId_fkey";

-- DropForeignKey
ALTER TABLE "SAFEInstrument" DROP CONSTRAINT "SAFEInstrument_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SAFEInstrument" DROP CONSTRAINT "SAFEInstrument_stakeholderId_fkey";

-- DropForeignKey
ALTER TABLE "Scenario" DROP CONSTRAINT "Scenario_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SecurityClass" DROP CONSTRAINT "SecurityClass_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Stakeholder" DROP CONSTRAINT "Stakeholder_companyId_fkey";

-- AddForeignKey
ALTER TABLE "Stakeholder" ADD CONSTRAINT "Stakeholder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityClass" ADD CONSTRAINT "SecurityClass_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityHolding" ADD CONSTRAINT "EquityHolding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityHolding" ADD CONSTRAINT "EquityHolding_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityHolding" ADD CONSTRAINT "EquityHolding_securityClassId_fkey" FOREIGN KEY ("securityClassId") REFERENCES "SecurityClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGrant" ADD CONSTRAINT "OptionGrant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGrant" ADD CONSTRAINT "OptionGrant_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAFEInstrument" ADD CONSTRAINT "SAFEInstrument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAFEInstrument" ADD CONSTRAINT "SAFEInstrument_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvertibleNote" ADD CONSTRAINT "ConvertibleNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvertibleNote" ADD CONSTRAINT "ConvertibleNote_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
