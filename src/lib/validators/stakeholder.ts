import { z } from "zod";
import { stakeholderTypeEnum } from "./shared";

const emailSchema = z
  .string()
  .trim()
  .email("Email must be a valid email address")
  .max(320, "Email is too long");

const baseStakeholderShape = {
  companyId: z
    .string({ required_error: "companyId is required" })
    .min(1, "companyId is required"),
  type: stakeholderTypeEnum,
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(200, "Name is too long"),
  email: emailSchema.optional().nullable(),
  notes: z.string().max(5000, "Notes are too long").optional().nullable(),
};

export const createStakeholderSchema = z.object(baseStakeholderShape);

export const updateStakeholderSchema = z
  .object({
    type: baseStakeholderShape.type.optional(),
    name: baseStakeholderShape.name.optional(),
    email: baseStakeholderShape.email,
    notes: baseStakeholderShape.notes,
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  });

export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>;
export type UpdateStakeholderInput = z.infer<typeof updateStakeholderSchema>;
