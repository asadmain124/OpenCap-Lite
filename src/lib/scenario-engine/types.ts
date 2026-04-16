import Decimal from "decimal.js";

export type WarningSeverity = "critical" | "high" | "medium" | "low";

export interface Warning {
  code: string;
  severity: WarningSeverity;
  message: string;
  entityType?: string;
  entityId?: string;
}

export interface OwnershipRow {
  stakeholderId: string | null;
  stakeholderName: string;
  securityType: string;
  shareCount: bigint;
  fullyDilutedShares: bigint;
  percentOfFD: Decimal;
  group: "common" | "preferred" | "options" | "reserved_pool" | "safe" | "note" | "new_money";
}

export interface ConvertibleDetail {
  instrumentType: "SAFE" | "NOTE";
  instrumentId: string;
  stakeholderName: string;
  label: string;
  principal: Decimal;
  accruedInterest: Decimal;
  totalConversionAmount: Decimal;
  capPrice: Decimal | null;
  discountPrice: Decimal | null;
  selectedPrice: Decimal | null;
  selectedMethod: "CAP" | "DISCOUNT" | "UNRESOLVED_MFN";
  sharesIssued: bigint;
  explanation: string;
}

export interface StageSnapshot {
  stageName: string;
  description: string;
  fullyDiluted: bigint;
  ownership: OwnershipRow[];
}

export interface ScenarioResult {
  inputs: ScenarioInput;
  intermediates: {
    pricePerShare: Decimal | null;
    pricePerShareMethod: string;
    preMoneyDenominatorShares: bigint;
    capDenominatorShares: bigint;
    baselineFullyDiluted: bigint;
    poolTopUpShares: bigint;
    poolTopUpMethod: string;
    newInvestorShares: bigint;
  };
  stages: StageSnapshot[];
  finalOwnership: OwnershipRow[];
  convertibleDetails: ConvertibleDetail[];
  warnings: Warning[];
  formulaTrace: string[];
}

// ---- Scenario Input shape (serializable; used by API and engine) ----

export interface BaselineHolding {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  securityClassId: string;
  securityClassName: string;
  securityType: "COMMON" | "PREFERRED" | "OPTION_POOL" | "WARRANT" | "LLC_UNIT" | "OTHER";
  shareCount: bigint;
  status: "ACTIVE" | "CANCELLED" | "REPURCHASED";
  pricePaidPerShare?: string | null;
  issueDate?: string | null;
}

export interface BaselineOptionGrant {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  optionCount: bigint;
  exercisedCount: bigint;
  cancelledCount: bigint;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  strikePrice: string;
  grantDate: string;
}

export interface BaselineSAFE {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  issueDate: string;
  purchaseAmount: string;
  valuationCap: string | null;
  discountPercent: string | null;
  mfn: boolean;
  postMoney: boolean;
  status: "OUTSTANDING" | "CONVERTED" | "CANCELLED";
  userSelectedMethod?: "CAP" | "DISCOUNT" | null;
  label?: string;
}

export interface BaselineNote {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  issueDate: string;
  maturityDate: string | null;
  principal: string;
  annualInterestRatePercent: string;
  interestType: "SIMPLE" | "COMPOUND";
  compoundingFrequencyPerYear: number | null;
  valuationCap: string | null;
  discountPercent: string | null;
  mfn: boolean;
  status: "OUTSTANDING" | "CONVERTED" | "REPAID" | "CANCELLED";
  userSelectedMethod?: "CAP" | "DISCOUNT" | null;
  label?: string;
}

export interface NewInstrument {
  type: "NEW_SAFE" | "NEW_NOTE" | "NEW_EQUITY" | "NEW_ACCELERATOR_EQUITY";
  label: string;
  stakeholderName: string;
  // Common fields; not all types use all of them.
  purchaseAmount?: string;
  valuationCap?: string | null;
  discountPercent?: string | null;
  postMoney?: boolean;
  mfn?: boolean;
  principal?: string;
  annualInterestRatePercent?: string;
  interestType?: "SIMPLE" | "COMPOUND";
  compoundingFrequencyPerYear?: number | null;
  issueDate?: string;
  maturityDate?: string | null;
  targetEquityPercent?: string; // For ACCELERATOR_EQUITY
  investmentAmount?: string; // For NEW_EQUITY (will solve shares from pps)
}

export interface ScenarioRound {
  roundType: "PRICED_ROUND" | "NEW_SAFE" | "NEW_NOTE" | "ACCELERATOR_EQUITY" | "BRIDGE";
  preMoneyValuation?: string | null;
  newMoney?: string | null;
  pricedRoundPricePerShareOverride?: string | null;
  roundCloseDate: string;
  optionPoolTopUpMode: "NONE" | "TO_TARGET_POST_MONEY_PERCENT" | "FIXED_SHARES" | "FIXED_PERCENT_PRE_MONEY";
  optionPoolTargetPercent?: string | null;
  optionPoolFixedShares?: string | null;
  optionPoolFixedPercentPreMoney?: string | null;
  capDenominatorMethod: "CURRENT_FULLY_DILUTED" | "FULLY_DILUTED_EXCLUDING_CONVERTIBLES" | "USER_OVERRIDE";
  capDenominatorOverride?: string | null;
  preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED" | "FULLY_DILUTED_EXCLUDING_CONVERTIBLES" | "USER_OVERRIDE";
  preMoneyDenominatorOverride?: string | null;
  conversionOrderingRule:
    | "NOTES_THEN_SAFES_THEN_NEW_MONEY"
    | "SAFES_THEN_NOTES_THEN_NEW_MONEY"
    | "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY"
    | "POOL_TOPUP_THEN_CONVERTIBLES_THEN_NEW_MONEY"
    | "CUSTOM_SIMPLIFIED";
  notesConvertUsing: "BEST_FOR_INVESTOR" | "CAP_ONLY" | "DISCOUNT_ONLY" | "USER_SELECTED_PER_NOTE";
  safesConvertUsing: "BEST_FOR_INVESTOR" | "CAP_ONLY" | "DISCOUNT_ONLY" | "USER_SELECTED_PER_SAFE";
  includeProRata?: boolean;
}

export interface ScenarioSettings {
  includeAllGrantedOptions?: boolean;
  includeCancelledGrants?: boolean;
  includeReservedUngranted?: boolean;
  reservedUngrantedPool?: string;
}

export interface ScenarioInput {
  companyName: string;
  authorizedCommonShares?: string | null;
  authorizedPreferredShares?: string | null;
  baseline: {
    holdings: BaselineHolding[];
    optionGrants: BaselineOptionGrant[];
    safes: BaselineSAFE[];
    notes: BaselineNote[];
    reservedUngrantedPool: string;
  };
  round: ScenarioRound;
  newInstruments: NewInstrument[];
  settings?: ScenarioSettings;
}
