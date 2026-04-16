import { z } from "zod";
import {
  currencyAmountSchema,
  dateSchema,
  decimalStringSchema,
  interestTypeEnum,
  noteStatusEnum,
  percentSchema,
} from "./shared";

/**
 * Enforces PRD §11 hard rules:
 *   - Maturity date >= issue date
 *   - Compound interest requires compoundingFrequencyPerYear
 *   - Money fields >= 0, percents 0-100
 */

const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/u, "Currency must be a 3-letter code like USD")
  .default("USD");

const baseShape = {
  companyId: z
    .string({ required_error: "companyId is required" })
    .min(1, "companyId is required"),
  stakeholderId: z
    .string({ required_error: "stakeholderId is required" })
    .min(1, "stakeholderId is required"),
  issueDate: dateSchema,
  maturityDate: dateSchema.optional().nullable(),
  principal: currencyAmountSchema,
  annualInterestRatePercent: percentSchema.default("0"),
  interestType: interestTypeEnum.default("SIMPLE"),
  compoundingFrequencyPerYear: z
    .number({ invalid_type_error: "Compounding frequency must be a number" })
    .int("Compounding frequency must be a whole number")
    .min(1, "Compounding frequency must be 1 or greater")
    .max(365, "Compounding frequency must be 365 or less")
    .optional()
    .nullable(),
  valuationCap: decimalStringSchema.optional().nullable(),
  discountPercent: percentSchema.optional().nullable(),
  mfn: z.boolean().default(false),
  status: noteStatusEnum.default("OUTSTANDING"),
  currency: currencyCodeSchema,
  notes: z.string().max(5000, "Notes are too long").optional().nullable(),
};

function applyNoteRules(
  val: {
    issueDate?: Date;
    maturityDate?: Date | null;
    interestType?: "SIMPLE" | "COMPOUND";
    compoundingFrequencyPerYear?: number | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (
    val.issueDate &&
    val.maturityDate &&
    val.maturityDate < val.issueDate
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maturityDate"],
      message: "Maturity date must be on or after the issue date",
    });
  }

  if (
    val.interestType === "COMPOUND" &&
    (val.compoundingFrequencyPerYear === undefined ||
      val.compoundingFrequencyPerYear === null)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compoundingFrequencyPerYear"],
      message:
        "Compounding frequency per year is required when interest type is compound",
    });
  }
}

export const createConvertibleNoteSchema = z
  .object(baseShape)
  .superRefine(applyNoteRules);

export const updateConvertibleNoteSchema = z
  .object({
    issueDate: baseShape.issueDate.optional(),
    maturityDate: baseShape.maturityDate,
    principal: baseShape.principal.optional(),
    annualInterestRatePercent: baseShape.annualInterestRatePercent.optional(),
    interestType: baseShape.interestType.optional(),
    compoundingFrequencyPerYear: baseShape.compoundingFrequencyPerYear,
    valuationCap: baseShape.valuationCap,
    discountPercent: baseShape.discountPercent,
    mfn: baseShape.mfn.optional(),
    status: baseShape.status.optional(),
    currency: currencyCodeSchema.optional(),
    notes: baseShape.notes,
  })
  .superRefine((val, ctx) => {
    applyNoteRules(val, ctx);
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  });

export type CreateConvertibleNoteInput = z.infer<
  typeof createConvertibleNoteSchema
>;
export type UpdateConvertibleNoteInput = z.infer<
  typeof updateConvertibleNoteSchema
>;
