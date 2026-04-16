import { z } from "zod";
import {
  currencyAmountSchema,
  dateSchema,
  decimalStringSchema,
  percentSchema,
  safeStatusEnum,
} from "./shared";

/**
 * Enforces PRD §11 hard rules:
 *   - cap-only SAFE → discount must be null
 *   - discount-only SAFE → cap must be null
 *   - at least one of cap or discount must be present (or it's MFN)
 *   - money fields >= 0
 *   - percents 0-100
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
  purchaseAmount: currencyAmountSchema,
  valuationCap: decimalStringSchema.optional().nullable(),
  discountPercent: percentSchema.optional().nullable(),
  mfn: z.boolean().default(false),
  postMoney: z.boolean().default(true),
  proRataRights: z.boolean().default(false),
  status: safeStatusEnum.default("OUTSTANDING"),
  sideLetterNotes: z
    .string()
    .max(5000, "Notes are too long")
    .optional()
    .nullable(),
  currency: currencyCodeSchema,
};

function applySafeRules(
  val: {
    valuationCap?: string | null;
    discountPercent?: string | null;
    mfn: boolean;
  },
  ctx: z.RefinementCtx,
): void {
  const hasCap = val.valuationCap !== undefined && val.valuationCap !== null;
  const hasDiscount =
    val.discountPercent !== undefined && val.discountPercent !== null;

  // PRD §11: cap-only must have discount null; discount-only must have cap null.
  // Both present is allowed (cap+discount); neither present is only OK if MFN.
  if (!hasCap && !hasDiscount && !val.mfn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["valuationCap"],
      message:
        "SAFE must have a valuation cap, a discount, or be marked MFN",
    });
  }
}

export const createSAFESchema = z
  .object(baseShape)
  .superRefine(applySafeRules);

export const updateSAFESchema = z
  .object({
    issueDate: baseShape.issueDate.optional(),
    purchaseAmount: baseShape.purchaseAmount.optional(),
    valuationCap: baseShape.valuationCap,
    discountPercent: baseShape.discountPercent,
    mfn: baseShape.mfn.optional(),
    postMoney: baseShape.postMoney.optional(),
    proRataRights: baseShape.proRataRights.optional(),
    status: baseShape.status.optional(),
    sideLetterNotes: baseShape.sideLetterNotes,
    currency: currencyCodeSchema.optional(),
  })
  .superRefine((val, ctx) => {
    // Only enforce mutual-exclusion rules when relevant fields are being set.
    if (val.valuationCap !== undefined || val.discountPercent !== undefined) {
      applySafeRules(
        {
          valuationCap: val.valuationCap,
          discountPercent: val.discountPercent,
          mfn: val.mfn ?? false,
        },
        ctx,
      );
    }
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  });

export type CreateSAFEInput = z.infer<typeof createSAFESchema>;
export type UpdateSAFEInput = z.infer<typeof updateSAFESchema>;
