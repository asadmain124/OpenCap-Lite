/**
 * Shared Zod sub-schemas used across entity validators.
 *
 * PRD §11 hard-rule helpers:
 *   - Share counts >= 0            → bigIntStringSchema
 *   - Money fields >= 0            → currencyAmountSchema
 *   - Percentages 0-100            → percentSchema
 *   - Vesting cliff/duration config → vestingSchema
 *
 * API shape conventions:
 *   - BigInt fields arrive as string | number on the wire; we coerce to bigint
 *     and reject non-integers and negatives.
 *   - Decimal fields arrive as string | number; we validate numeric shape and
 *     pass through as a canonical string (Prisma converts to Decimal).
 */

import { z } from "zod";

// ---------- Numeric helpers ----------

/** Parse a string or number into a bigint, rejecting non-integers and negatives. */
export const bigIntStringSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value, ctx) => {
    let text: string;
    if (typeof value === "bigint") {
      text = value.toString();
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Share count must be a finite number",
        });
        return z.NEVER;
      }
      if (!Number.isInteger(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Share count must be a whole number (no decimals)",
        });
        return z.NEVER;
      }
      text = value.toString();
    } else {
      text = value.trim();
      if (text === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Share count is required",
        });
        return z.NEVER;
      }
    }

    // Accept optional leading sign + pure digits only (no decimals, no exponents)
    if (!/^-?\d+$/.test(text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Share count must be a whole number (no decimals)",
      });
      return z.NEVER;
    }

    let big: bigint;
    try {
      big = BigInt(text);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Share count could not be parsed as an integer",
      });
      return z.NEVER;
    }

    if (big < 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Share count must be 0 or greater",
      });
      return z.NEVER;
    }

    return big;
  });

/**
 * Parse a decimal string/number, validate numeric shape, return as canonical
 * string so Prisma can convert to Decimal without losing precision.
 *
 * Rejects negatives (use a different schema if you need signed decimals).
 */
export const decimalStringSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    let text: string;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount must be a finite number",
        });
        return z.NEVER;
      }
      text = value.toString();
    } else {
      text = value.trim();
      if (text === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount is required",
        });
        return z.NEVER;
      }
    }

    // Match optional sign, digits, optional fractional part. No scientific notation.
    if (!/^-?\d+(\.\d+)?$/.test(text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be a valid decimal number",
      });
      return z.NEVER;
    }

    if (text.startsWith("-")) {
      // Reject negatives unless caller opts in (we export decimalStringSignedSchema below).
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be 0 or greater",
      });
      return z.NEVER;
    }

    return text;
  });

/** Percentage 0-100 inclusive; returned as canonical string for Prisma. */
export const percentSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    let num: number;
    if (typeof value === "number") {
      num = value;
    } else {
      const trimmed = value.trim();
      if (trimmed === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percent is required",
        });
        return z.NEVER;
      }
      num = Number(trimmed);
    }

    if (!Number.isFinite(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percent must be a valid number",
      });
      return z.NEVER;
    }
    if (num < 0 || num > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percent must be between 0 and 100",
      });
      return z.NEVER;
    }

    return num.toString();
  });

/** Currency amount (>= 0). Alias for decimalStringSchema with a currency-flavored message. */
export const currencyAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed = decimalStringSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            issue.message === "Amount must be 0 or greater"
              ? "Money amount must be 0 or greater"
              : issue.message.replace(/^Amount/, "Money amount"),
        });
      }
      return z.NEVER;
    }
    return parsed.data;
  });

// ---------- Vesting ----------

export const vestingFrequencyEnum = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "NONE",
]);

/** Vesting sub-schema: cliff, duration, frequency. All fields optional for ungated grants. */
export const vestingSchema = z
  .object({
    vestingStartDate: z.coerce
      .date({ invalid_type_error: "Vesting start date must be a valid date" })
      .optional()
      .nullable(),
    vestingCliffMonths: z
      .number({ invalid_type_error: "Cliff months must be a number" })
      .int("Cliff months must be a whole number")
      .min(0, "Cliff months must be 0 or greater")
      .optional()
      .nullable(),
    vestingDurationMonths: z
      .number({ invalid_type_error: "Duration months must be a number" })
      .int("Duration months must be a whole number")
      .min(0, "Duration months must be 0 or greater")
      .optional()
      .nullable(),
    vestingFrequency: vestingFrequencyEnum.default("NONE"),
  })
  .superRefine((val, ctx) => {
    const cliff = val.vestingCliffMonths ?? null;
    const duration = val.vestingDurationMonths ?? null;
    if (cliff !== null && duration !== null && cliff > duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vestingCliffMonths"],
        message: "Cliff months cannot exceed total duration",
      });
    }
  });

// ---------- Dates ----------

/** Accepts Date, ISO string, or epoch number; returns Date. */
export const dateSchema = z.coerce.date({
  invalid_type_error: "Must be a valid date",
});

// ---------- Enums (mirrored from Prisma) ----------

export const stakeholderTypeEnum = z.enum([
  "FOUNDER",
  "EMPLOYEE",
  "ADVISOR",
  "ANGEL",
  "VC",
  "ACCELERATOR",
  "OTHER",
]);

export const securityTypeEnum = z.enum([
  "COMMON",
  "PREFERRED",
  "OPTION_POOL",
  "WARRANT",
  "LLC_UNIT",
  "OTHER",
]);

export const holdingStatusEnum = z.enum(["ACTIVE", "CANCELLED", "REPURCHASED"]);

export const optionGrantStatusEnum = z.enum([
  "ACTIVE",
  "CANCELLED",
  "EXPIRED",
]);

export const safeStatusEnum = z.enum(["OUTSTANDING", "CONVERTED", "CANCELLED"]);

export const noteStatusEnum = z.enum([
  "OUTSTANDING",
  "CONVERTED",
  "REPAID",
  "CANCELLED",
]);

export const interestTypeEnum = z.enum(["SIMPLE", "COMPOUND"]);

export const baselineModeEnum = z.enum(["LIVE_CAP_TABLE", "SNAPSHOT"]);

export const roundTypeEnum = z.enum([
  "PRICED_ROUND",
  "NEW_SAFE",
  "NEW_NOTE",
  "ACCELERATOR_EQUITY",
  "BRIDGE",
]);

export const optionPoolTopUpModeEnum = z.enum([
  "NONE",
  "TO_TARGET_POST_MONEY_PERCENT",
  "FIXED_SHARES",
  "FIXED_PERCENT_PRE_MONEY",
]);

export const conversionOrderingRuleEnum = z.enum([
  "NOTES_THEN_SAFES_THEN_NEW_MONEY",
  "SAFES_THEN_NOTES_THEN_NEW_MONEY",
  "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
  "POOL_TOPUP_THEN_CONVERTIBLES_THEN_NEW_MONEY",
  "CUSTOM_SIMPLIFIED",
]);

export const notesConvertUsingEnum = z.enum([
  "BEST_FOR_INVESTOR",
  "CAP_ONLY",
  "DISCOUNT_ONLY",
  "USER_SELECTED_PER_NOTE",
]);

export const safesConvertUsingEnum = z.enum([
  "BEST_FOR_INVESTOR",
  "CAP_ONLY",
  "DISCOUNT_ONLY",
  "USER_SELECTED_PER_SAFE",
]);

export const newInstrumentTypeEnum = z.enum([
  "NEW_SAFE",
  "NEW_NOTE",
  "NEW_EQUITY",
  "NEW_ACCELERATOR_EQUITY",
]);

export const capDenominatorMethodEnum = z.enum([
  "CURRENT_FULLY_DILUTED",
  "FULLY_DILUTED_EXCLUDING_CONVERTIBLES",
  "USER_OVERRIDE",
]);

export const preMoneyDenominatorMethodEnum = z.enum([
  "CURRENT_FULLY_DILUTED",
  "FULLY_DILUTED_EXCLUDING_CONVERTIBLES",
  "USER_OVERRIDE",
]);

export type VestingInput = z.infer<typeof vestingSchema>;
