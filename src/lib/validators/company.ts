import { z } from "zod";
import { bigIntStringSchema, dateSchema } from "./shared";

/** ISO 4217-ish currency code; uppercase 3 letters. Loose validation. */
const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/u, "Currency must be a 3-letter code like USD");

const baseCompanyShape = {
  legalName: z
    .string({ required_error: "Company legal name is required" })
    .trim()
    .min(1, "Company legal name is required")
    .max(200, "Company legal name is too long"),
  jurisdiction: z
    .string({ required_error: "Jurisdiction is required" })
    .trim()
    .min(1, "Jurisdiction is required")
    .max(120, "Jurisdiction is too long"),
  incorporationDate: dateSchema.optional().nullable(),
  authorizedCommonShares: bigIntStringSchema.optional(),
  authorizedPreferredShares: bigIntStringSchema.optional(),
  defaultCurrency: currencyCodeSchema.default("USD"),
  settings: z.record(z.unknown()).optional().nullable(),
};

export const createCompanySchema = z.object(baseCompanyShape);

export const updateCompanySchema = z
  .object({
    legalName: baseCompanyShape.legalName.optional(),
    jurisdiction: baseCompanyShape.jurisdiction.optional(),
    incorporationDate: baseCompanyShape.incorporationDate,
    authorizedCommonShares: baseCompanyShape.authorizedCommonShares,
    authorizedPreferredShares: baseCompanyShape.authorizedPreferredShares,
    defaultCurrency: currencyCodeSchema.optional(),
    settings: baseCompanyShape.settings,
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  });

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
