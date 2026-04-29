/**
 * Shared form value types for the Scenario Workbench (wizard + expert modes).
 * These are the working draft shape; on save they're converted to the API
 * payload shape (see lib/validators/scenario.ts for server-side schemas).
 */

export type PayloadRound = {
  roundType:
    | "PRICED_ROUND"
    | "NEW_SAFE"
    | "NEW_NOTE"
    | "ACCELERATOR_EQUITY"
    | "BRIDGE";
  preMoneyValuation: string | null;
  newMoney: string | null;
  pricedRoundPricePerShareOverride: string | null;
  roundCloseDate: string;
  optionPoolTopUpMode:
    | "NONE"
    | "TO_TARGET_POST_MONEY_PERCENT"
    | "FIXED_SHARES"
    | "FIXED_PERCENT_PRE_MONEY";
  optionPoolTargetPercent: string | null;
  optionPoolFixedShares: string | null;
  optionPoolFixedPercentPreMoney: string | null;
  capDenominatorMethod:
    | "CURRENT_FULLY_DILUTED"
    | "FULLY_DILUTED_EXCLUDING_CONVERTIBLES"
    | "USER_OVERRIDE";
  capDenominatorOverride: string | null;
  preMoneyDenominatorMethod:
    | "CURRENT_FULLY_DILUTED"
    | "FULLY_DILUTED_EXCLUDING_CONVERTIBLES"
    | "USER_OVERRIDE";
  preMoneyDenominatorOverride: string | null;
  conversionOrderingRule:
    | "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY"
    | "NOTES_THEN_SAFES_THEN_NEW_MONEY"
    | "SAFES_THEN_NOTES_THEN_NEW_MONEY"
    | "POOL_TOPUP_THEN_CONVERTIBLES_THEN_NEW_MONEY"
    | "CUSTOM_SIMPLIFIED";
  notesConvertUsing:
    | "BEST_FOR_INVESTOR"
    | "CAP_ONLY"
    | "DISCOUNT_ONLY"
    | "USER_SELECTED_PER_NOTE";
  safesConvertUsing:
    | "BEST_FOR_INVESTOR"
    | "CAP_ONLY"
    | "DISCOUNT_ONLY"
    | "USER_SELECTED_PER_SAFE";
  includeProRata: boolean;
};

export type NewInstrumentDraft = {
  /** Stable client-side id for warning correlation; not sent to server. */
  id: string;
  type: "NEW_SAFE" | "NEW_NOTE" | "NEW_EQUITY" | "NEW_ACCELERATOR_EQUITY";
  label: string;
  stakeholderName: string;
  purchaseAmount?: string;
  valuationCap?: string;
  discountPercent?: string;
  investmentAmount?: string;
  targetEquityPercent?: string;
  principal?: string;
  annualInterestRatePercent?: string;
  interestType?: "SIMPLE" | "COMPOUND";
  compoundingFrequencyPerYear?: number | null;
};

export interface ScenarioFormValues {
  name: string;
  description: string;
  round: PayloadRound;
  newInstruments: NewInstrumentDraft[];
}

export interface InitialScenarioState {
  id?: string;
  name: string;
  description: string;
  round: PayloadRound;
  newInstruments: NewInstrumentDraft[];
}

export const DEFAULT_ROUND: PayloadRound = {
  roundType: "PRICED_ROUND",
  preMoneyValuation: "8000000",
  newMoney: "2000000",
  pricedRoundPricePerShareOverride: null,
  roundCloseDate: new Date().toISOString().slice(0, 10),
  optionPoolTopUpMode: "NONE",
  optionPoolTargetPercent: null,
  optionPoolFixedShares: null,
  optionPoolFixedPercentPreMoney: null,
  capDenominatorMethod: "CURRENT_FULLY_DILUTED",
  capDenominatorOverride: null,
  preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED",
  preMoneyDenominatorOverride: null,
  conversionOrderingRule: "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
  notesConvertUsing: "BEST_FOR_INVESTOR",
  safesConvertUsing: "BEST_FOR_INVESTOR",
  includeProRata: false,
};

export function serializeNewInstrument(i: NewInstrumentDraft) {
  return {
    type: i.type,
    label: i.label,
    stakeholderName: i.stakeholderName,
    purchaseAmount: i.purchaseAmount,
    valuationCap: i.valuationCap || null,
    discountPercent: i.discountPercent || null,
    investmentAmount: i.investmentAmount,
    targetEquityPercent: i.targetEquityPercent,
    principal: i.principal,
    annualInterestRatePercent: i.annualInterestRatePercent,
    interestType: i.interestType,
    compoundingFrequencyPerYear: i.compoundingFrequencyPerYear ?? null,
  };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `nid-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
