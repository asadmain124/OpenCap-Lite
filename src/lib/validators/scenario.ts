import { z } from "zod";
import {
  baselineModeEnum,
  bigIntStringSchema,
  capDenominatorMethodEnum,
  conversionOrderingRuleEnum,
  currencyAmountSchema,
  dateSchema,
  decimalStringSchema,
  holdingStatusEnum,
  interestTypeEnum,
  newInstrumentTypeEnum,
  noteStatusEnum,
  notesConvertUsingEnum,
  optionGrantStatusEnum,
  optionPoolTopUpModeEnum,
  percentSchema,
  preMoneyDenominatorMethodEnum,
  roundTypeEnum,
  safeStatusEnum,
  safesConvertUsingEnum,
  securityTypeEnum,
} from "./shared";

/* -------------------------------------------------------------------------- */
/* Saved Scenario (create/update payload persisted to DB)                     */
/* -------------------------------------------------------------------------- */

const scenarioShape = {
  companyId: z
    .string({ required_error: "companyId is required" })
    .min(1, "companyId is required"),
  name: z
    .string({ required_error: "Scenario name is required" })
    .trim()
    .min(1, "Scenario name is required")
    .max(200, "Scenario name is too long"),
  description: z
    .string()
    .max(5000, "Description is too long")
    .optional()
    .nullable(),
  baselineMode: baselineModeEnum.default("LIVE_CAP_TABLE"),
  snapshotJson: z.record(z.unknown()).optional().nullable(),
};

const roundInputShape = {
  roundType: roundTypeEnum.default("PRICED_ROUND"),
  preMoneyValuation: currencyAmountSchema.optional().nullable(),
  newMoney: currencyAmountSchema.optional().nullable(),
  pricedRoundPricePerShareOverride: decimalStringSchema.optional().nullable(),
  roundCloseDate: dateSchema.optional().nullable(),
  optionPoolTopUpMode: optionPoolTopUpModeEnum.default("NONE"),
  optionPoolTargetPercent: percentSchema.optional().nullable(),
  optionPoolFixedShares: bigIntStringSchema.optional().nullable(),
  optionPoolFixedPercentPreMoney: percentSchema.optional().nullable(),
  capDenominatorMethod: capDenominatorMethodEnum.default(
    "CURRENT_FULLY_DILUTED",
  ),
  capDenominatorOverride: bigIntStringSchema.optional().nullable(),
  preMoneyDenominatorMethod: preMoneyDenominatorMethodEnum.default(
    "CURRENT_FULLY_DILUTED",
  ),
  preMoneyDenominatorOverride: bigIntStringSchema.optional().nullable(),
  conversionOrderingRule: conversionOrderingRuleEnum.default(
    "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
  ),
  notesConvertUsing: notesConvertUsingEnum.default("BEST_FOR_INVESTOR"),
  safesConvertUsing: safesConvertUsingEnum.default("BEST_FOR_INVESTOR"),
  mfnFallback: z.string().max(200).optional().nullable(),
  includeProRata: z.boolean().default(false),
};

export const scenarioRoundInputSchema = z.object(roundInputShape);

/**
 * New-instrument notesJson shape, generic over instrument type. Different
 * types use different sub-fields; we permit all but validate conditionally.
 */
export const scenarioNewInstrumentNotesSchema = z
  .object({
    stakeholderName: z.string().trim().min(1, "Stakeholder name is required"),
    // SAFE / Note common
    purchaseAmount: currencyAmountSchema.optional(),
    valuationCap: decimalStringSchema.optional().nullable(),
    discountPercent: percentSchema.optional().nullable(),
    postMoney: z.boolean().optional(),
    mfn: z.boolean().optional(),
    // Note-specific
    principal: currencyAmountSchema.optional(),
    annualInterestRatePercent: percentSchema.optional(),
    interestType: interestTypeEnum.optional(),
    compoundingFrequencyPerYear: z.number().int().min(1).max(365).optional().nullable(),
    issueDate: z.string().optional(),
    maturityDate: z.string().optional().nullable(),
    // Accelerator-specific
    targetEquityPercent: percentSchema.optional(),
    // New equity-specific
    investmentAmount: currencyAmountSchema.optional(),
  })
  .passthrough();

export const scenarioNewInstrumentInputSchema = z.object({
  type: newInstrumentTypeEnum,
  label: z.string().trim().min(1, "Instrument label is required").max(200),
  notesJson: scenarioNewInstrumentNotesSchema,
});

/**
 * Full scenario create payload: { scenario, roundInput, newInstrumentInputs }
 *
 * Enforces PRD §11 hard rules across the nested input:
 *   - Cap-only SAFE: discount must be null (per new instrument)
 *   - Discount-only SAFE: cap must be null (per new instrument)
 *   - Compound interest requires compoundingFrequencyPerYear
 *   - Maturity >= issue date
 *   - Accelerator equity instruments require targetEquityPercent
 *   - Money/percent/share fields obey shared constraints
 */
export const createScenarioSchema = z
  .object({
    scenario: z.object(scenarioShape),
    roundInput: scenarioRoundInputSchema,
    newInstrumentInputs: z.array(scenarioNewInstrumentInputSchema).default([]),
  })
  .superRefine((val, ctx) => {
    // Validate each new instrument per its type.
    val.newInstrumentInputs.forEach((inst, idx) => {
      const notes = inst.notesJson;

      if (inst.type === "NEW_SAFE") {
        const hasCap =
          notes.valuationCap !== undefined && notes.valuationCap !== null;
        const hasDiscount =
          notes.discountPercent !== undefined &&
          notes.discountPercent !== null;
        if (!hasCap && !hasDiscount && notes.mfn !== true) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["newInstrumentInputs", idx, "notesJson", "valuationCap"],
            message:
              "New SAFE must have a valuation cap, a discount, or be marked MFN",
          });
        }
        if (notes.purchaseAmount === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["newInstrumentInputs", idx, "notesJson", "purchaseAmount"],
            message: "New SAFE requires a purchase amount",
          });
        }
      } else if (inst.type === "NEW_NOTE") {
        if (notes.principal === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["newInstrumentInputs", idx, "notesJson", "principal"],
            message: "New note requires a principal amount",
          });
        }
        if (
          notes.interestType === "COMPOUND" &&
          (notes.compoundingFrequencyPerYear === undefined ||
            notes.compoundingFrequencyPerYear === null)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              "newInstrumentInputs",
              idx,
              "notesJson",
              "compoundingFrequencyPerYear",
            ],
            message:
              "Compounding frequency per year is required when interest type is compound",
          });
        }
        if (notes.issueDate && notes.maturityDate) {
          const issue = new Date(notes.issueDate);
          const maturity = new Date(notes.maturityDate);
          if (
            !Number.isNaN(issue.getTime()) &&
            !Number.isNaN(maturity.getTime()) &&
            maturity < issue
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [
                "newInstrumentInputs",
                idx,
                "notesJson",
                "maturityDate",
              ],
              message: "Maturity date must be on or after the issue date",
            });
          }
        }
      } else if (inst.type === "NEW_ACCELERATOR_EQUITY") {
        if (
          notes.targetEquityPercent === undefined ||
          notes.targetEquityPercent === null
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              "newInstrumentInputs",
              idx,
              "notesJson",
              "targetEquityPercent",
            ],
            message:
              "Accelerator equity template requires a target equity percent",
          });
        }
      } else if (inst.type === "NEW_EQUITY") {
        if (notes.investmentAmount === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              "newInstrumentInputs",
              idx,
              "notesJson",
              "investmentAmount",
            ],
            message: "New equity instrument requires an investment amount",
          });
        }
      }
    });

    // Round-level: priced round should have pre-money + new money (soft recommended, hard if both missing)
    if (val.roundInput.roundType === "PRICED_ROUND") {
      if (
        val.roundInput.preMoneyValuation === undefined ||
        val.roundInput.preMoneyValuation === null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roundInput", "preMoneyValuation"],
          message: "Priced rounds require a pre-money valuation",
        });
      }
      if (
        val.roundInput.newMoney === undefined ||
        val.roundInput.newMoney === null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roundInput", "newMoney"],
          message: "Priced rounds require a new money amount",
        });
      }
    }

    // Pool top-up mode requires matching parameter.
    if (val.roundInput.optionPoolTopUpMode === "TO_TARGET_POST_MONEY_PERCENT") {
      if (
        val.roundInput.optionPoolTargetPercent === undefined ||
        val.roundInput.optionPoolTargetPercent === null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roundInput", "optionPoolTargetPercent"],
          message:
            "Target post-money pool percent is required for TO_TARGET_POST_MONEY_PERCENT mode",
        });
      }
    }
    if (val.roundInput.optionPoolTopUpMode === "FIXED_SHARES") {
      if (
        val.roundInput.optionPoolFixedShares === undefined ||
        val.roundInput.optionPoolFixedShares === null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roundInput", "optionPoolFixedShares"],
          message: "Fixed share count is required for FIXED_SHARES mode",
        });
      }
    }
    if (val.roundInput.optionPoolTopUpMode === "FIXED_PERCENT_PRE_MONEY") {
      if (
        val.roundInput.optionPoolFixedPercentPreMoney === undefined ||
        val.roundInput.optionPoolFixedPercentPreMoney === null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roundInput", "optionPoolFixedPercentPreMoney"],
          message:
            "Fixed pre-money percent is required for FIXED_PERCENT_PRE_MONEY mode",
        });
      }
    }
  });

export const updateScenarioSchema = z.object({
  scenario: z
    .object({
      name: scenarioShape.name.optional(),
      description: scenarioShape.description,
      baselineMode: scenarioShape.baselineMode.optional(),
      snapshotJson: scenarioShape.snapshotJson,
    })
    .optional(),
  roundInput: scenarioRoundInputSchema.partial().optional(),
  newInstrumentInputs: z
    .array(scenarioNewInstrumentInputSchema)
    .optional(),
});

export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;

/* -------------------------------------------------------------------------- */
/* Scenario Calculate Payload — matches ScenarioInput from scenario-engine    */
/* -------------------------------------------------------------------------- */

/*
 * The engine accepts a fully serializable payload. We validate with Zod but
 * keep the same shape as ScenarioInput so the output is directly consumable.
 *
 * BigInt values on the engine's input (shareCount, optionCount, ...) arrive
 * as strings/numbers over the wire, but the engine types declare them as
 * bigint. We coerce via bigIntStringSchema so the validated output matches.
 */

const baselineHoldingSchema = z.object({
  id: z.string().min(1),
  stakeholderId: z.string().min(1),
  stakeholderName: z.string().min(1),
  securityClassId: z.string().min(1),
  securityClassName: z.string().min(1),
  securityType: securityTypeEnum,
  shareCount: bigIntStringSchema,
  status: holdingStatusEnum,
  pricePaidPerShare: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
});

const baselineOptionGrantSchema = z.object({
  id: z.string().min(1),
  stakeholderId: z.string().min(1),
  stakeholderName: z.string().min(1),
  optionCount: bigIntStringSchema,
  exercisedCount: bigIntStringSchema,
  cancelledCount: bigIntStringSchema,
  status: optionGrantStatusEnum,
  strikePrice: z.string(),
  grantDate: z.string(),
});

const baselineSAFESchema = z.object({
  id: z.string().min(1),
  stakeholderId: z.string().min(1),
  stakeholderName: z.string().min(1),
  issueDate: z.string(),
  purchaseAmount: z.string(),
  valuationCap: z.string().nullable(),
  discountPercent: z.string().nullable(),
  mfn: z.boolean(),
  postMoney: z.boolean(),
  status: safeStatusEnum,
  userSelectedMethod: z.enum(["CAP", "DISCOUNT"]).optional().nullable(),
  label: z.string().optional(),
});

const baselineNoteSchema = z.object({
  id: z.string().min(1),
  stakeholderId: z.string().min(1),
  stakeholderName: z.string().min(1),
  issueDate: z.string(),
  maturityDate: z.string().nullable(),
  principal: z.string(),
  annualInterestRatePercent: z.string(),
  interestType: interestTypeEnum,
  compoundingFrequencyPerYear: z.number().int().nullable(),
  valuationCap: z.string().nullable(),
  discountPercent: z.string().nullable(),
  mfn: z.boolean(),
  status: noteStatusEnum,
  userSelectedMethod: z.enum(["CAP", "DISCOUNT"]).optional().nullable(),
  label: z.string().optional(),
});

const newInstrumentEngineSchema = z
  .object({
    type: newInstrumentTypeEnum,
    label: z.string().min(1, "Label is required"),
    stakeholderName: z.string().min(1, "Stakeholder name is required"),
    purchaseAmount: z.string().optional(),
    valuationCap: z.string().optional().nullable(),
    discountPercent: z.string().optional().nullable(),
    postMoney: z.boolean().optional(),
    mfn: z.boolean().optional(),
    principal: z.string().optional(),
    annualInterestRatePercent: z.string().optional(),
    interestType: interestTypeEnum.optional(),
    compoundingFrequencyPerYear: z.number().int().optional().nullable(),
    issueDate: z.string().optional(),
    maturityDate: z.string().optional().nullable(),
    targetEquityPercent: z.string().optional(),
    investmentAmount: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "NEW_SAFE") {
      const hasCap = val.valuationCap !== undefined && val.valuationCap !== null;
      const hasDiscount =
        val.discountPercent !== undefined && val.discountPercent !== null;
      if (!hasCap && !hasDiscount && val.mfn !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["valuationCap"],
          message: "New SAFE requires cap, discount, or MFN",
        });
      }
    }
    if (val.type === "NEW_NOTE") {
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
    if (
      val.type === "NEW_ACCELERATOR_EQUITY" &&
      (val.targetEquityPercent === undefined ||
        val.targetEquityPercent === null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetEquityPercent"],
        message:
          "Accelerator equity template requires a target equity percent",
      });
    }
  });

const scenarioRoundEngineSchema = z.object({
  roundType: roundTypeEnum,
  preMoneyValuation: z.string().optional().nullable(),
  newMoney: z.string().optional().nullable(),
  pricedRoundPricePerShareOverride: z.string().optional().nullable(),
  roundCloseDate: z.string().min(1, "Round close date is required"),
  optionPoolTopUpMode: optionPoolTopUpModeEnum,
  optionPoolTargetPercent: z.string().optional().nullable(),
  optionPoolFixedShares: z.string().optional().nullable(),
  optionPoolFixedPercentPreMoney: z.string().optional().nullable(),
  capDenominatorMethod: capDenominatorMethodEnum,
  capDenominatorOverride: z.string().optional().nullable(),
  preMoneyDenominatorMethod: preMoneyDenominatorMethodEnum,
  preMoneyDenominatorOverride: z.string().optional().nullable(),
  conversionOrderingRule: conversionOrderingRuleEnum,
  notesConvertUsing: notesConvertUsingEnum,
  safesConvertUsing: safesConvertUsingEnum,
  includeProRata: z.boolean().optional(),
});

const scenarioSettingsSchema = z.object({
  includeAllGrantedOptions: z.boolean().optional(),
  includeCancelledGrants: z.boolean().optional(),
  includeReservedUngranted: z.boolean().optional(),
  reservedUngrantedPool: z.string().optional(),
});

/**
 * Payload for POST /api/scenarios/calculate.
 *
 * The output type (after Zod parsing) matches the engine's `ScenarioInput`:
 * BigInt fields arrive on the wire as string/number and are coerced to bigint.
 */
export const scenarioCalculatePayloadSchema = z
  .object({
    companyName: z.string().min(1, "Company name is required"),
    authorizedCommonShares: z.string().optional().nullable(),
    authorizedPreferredShares: z.string().optional().nullable(),
    baseline: z.object({
      holdings: z.array(baselineHoldingSchema),
      optionGrants: z.array(baselineOptionGrantSchema),
      safes: z.array(baselineSAFESchema),
      notes: z.array(baselineNoteSchema),
      reservedUngrantedPool: z.string(),
    }),
    round: scenarioRoundEngineSchema,
    newInstruments: z.array(newInstrumentEngineSchema),
    settings: scenarioSettingsSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.round.roundType === "PRICED_ROUND") {
      if (
        (val.round.preMoneyValuation === undefined ||
          val.round.preMoneyValuation === null) &&
        (val.round.pricedRoundPricePerShareOverride === undefined ||
          val.round.pricedRoundPricePerShareOverride === null)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["round", "preMoneyValuation"],
          message:
            "Priced rounds require a pre-money valuation or a price-per-share override",
        });
      }
      if (val.round.newMoney === undefined || val.round.newMoney === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["round", "newMoney"],
          message: "Priced rounds require a new money amount",
        });
      }
    }
  });

export type ScenarioCalculatePayload = z.infer<
  typeof scenarioCalculatePayloadSchema
>;
