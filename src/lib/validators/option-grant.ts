import { z } from "zod";
import {
  bigIntStringSchema,
  dateSchema,
  decimalStringSchema,
  optionGrantStatusEnum,
  vestingSchema,
} from "./shared";

const baseShape = {
  companyId: z
    .string({ required_error: "companyId is required" })
    .min(1, "companyId is required"),
  stakeholderId: z
    .string({ required_error: "stakeholderId is required" })
    .min(1, "stakeholderId is required"),
  optionCount: bigIntStringSchema,
  exercisedCount: bigIntStringSchema.optional(),
  cancelledCount: bigIntStringSchema.optional(),
  strikePrice: decimalStringSchema,
  grantDate: dateSchema,
  expirationDate: dateSchema.optional().nullable(),
  status: optionGrantStatusEnum.default("ACTIVE"),
  notes: z.string().max(5000, "Notes are too long").optional().nullable(),
};

export const createOptionGrantSchema = z
  .object({
    ...baseShape,
    vesting: vestingSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.expirationDate && val.expirationDate < val.grantDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expirationDate"],
        message: "Expiration date must be on or after grant date",
      });
    }
  })
  .transform(({ vesting, ...rest }) => ({
    ...rest,
    vestingStartDate: vesting?.vestingStartDate ?? null,
    vestingCliffMonths: vesting?.vestingCliffMonths ?? null,
    vestingDurationMonths: vesting?.vestingDurationMonths ?? null,
    vestingFrequency: vesting?.vestingFrequency ?? "NONE",
  }));

export const updateOptionGrantSchema = z
  .object({
    optionCount: baseShape.optionCount.optional(),
    exercisedCount: baseShape.exercisedCount,
    cancelledCount: baseShape.cancelledCount,
    strikePrice: baseShape.strikePrice.optional(),
    grantDate: baseShape.grantDate.optional(),
    expirationDate: baseShape.expirationDate,
    status: baseShape.status.optional(),
    notes: baseShape.notes,
    vesting: vestingSchema.optional(),
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  });

export type CreateOptionGrantInput = z.infer<typeof createOptionGrantSchema>;
export type UpdateOptionGrantInput = z.infer<typeof updateOptionGrantSchema>;
