import { z } from "zod";
import {
  bigIntStringSchema,
  decimalStringSchema,
  securityTypeEnum,
} from "./shared";

const baseShape = {
  companyId: z
    .string({ required_error: "companyId is required" })
    .min(1, "companyId is required"),
  name: z
    .string({ required_error: "Security class name is required" })
    .trim()
    .min(1, "Security class name is required")
    .max(200, "Security class name is too long"),
  type: securityTypeEnum,
  seniorityOrder: z
    .number({ invalid_type_error: "Seniority order must be a number" })
    .int("Seniority order must be a whole number")
    .min(0, "Seniority order must be 0 or greater")
    .default(0),
  authorizedShares: bigIntStringSchema.optional().nullable(),
  liquidationPreferenceMultiple: decimalStringSchema.optional().nullable(),
  participationRights: z.boolean().default(false),
  reservedUngrantedShares: bigIntStringSchema.optional().nullable(),
};

export const createSecurityClassSchema = z.object(baseShape);

export const updateSecurityClassSchema = z
  .object({
    name: baseShape.name.optional(),
    type: baseShape.type.optional(),
    seniorityOrder: baseShape.seniorityOrder.optional(),
    authorizedShares: baseShape.authorizedShares,
    liquidationPreferenceMultiple: baseShape.liquidationPreferenceMultiple,
    participationRights: baseShape.participationRights.optional(),
    reservedUngrantedShares: baseShape.reservedUngrantedShares,
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  });

export type CreateSecurityClassInput = z.infer<
  typeof createSecurityClassSchema
>;
export type UpdateSecurityClassInput = z.infer<
  typeof updateSecurityClassSchema
>;
