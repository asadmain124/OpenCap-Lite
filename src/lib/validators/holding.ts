import { z } from "zod";
import {
  bigIntStringSchema,
  dateSchema,
  decimalStringSchema,
  holdingStatusEnum,
  vestingSchema,
} from "./shared";

const baseShape = {
  companyId: z
    .string({ required_error: "companyId is required" })
    .min(1, "companyId is required"),
  stakeholderId: z
    .string({ required_error: "stakeholderId is required" })
    .min(1, "stakeholderId is required"),
  securityClassId: z
    .string({ required_error: "securityClassId is required" })
    .min(1, "securityClassId is required"),
  shareCount: bigIntStringSchema,
  pricePaidPerShare: decimalStringSchema.optional().nullable(),
  issueDate: dateSchema,
  status: holdingStatusEnum.default("ACTIVE"),
  certificateNumber: z
    .string()
    .max(100, "Certificate number is too long")
    .optional()
    .nullable(),
  notes: z.string().max(5000, "Notes are too long").optional().nullable(),
};

/** Vesting is optional; if present, we validate via vestingSchema and flatten. */
export const createEquityHoldingSchema = z
  .object({
    ...baseShape,
    vesting: vestingSchema.optional(),
  })
  .transform(({ vesting, ...rest }) => ({
    ...rest,
    vestingStartDate: vesting?.vestingStartDate ?? null,
    vestingCliffMonths: vesting?.vestingCliffMonths ?? null,
    vestingDurationMonths: vesting?.vestingDurationMonths ?? null,
    vestingFrequency: vesting?.vestingFrequency ?? "NONE",
  }));

export const updateEquityHoldingSchema = z
  .object({
    shareCount: baseShape.shareCount.optional(),
    pricePaidPerShare: baseShape.pricePaidPerShare,
    issueDate: baseShape.issueDate.optional(),
    status: baseShape.status.optional(),
    certificateNumber: baseShape.certificateNumber,
    notes: baseShape.notes,
    vesting: vestingSchema.optional(),
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  });

export type CreateEquityHoldingInput = z.infer<
  typeof createEquityHoldingSchema
>;
export type UpdateEquityHoldingInput = z.infer<
  typeof updateEquityHoldingSchema
>;
