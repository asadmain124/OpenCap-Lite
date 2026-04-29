/**
 * Plain-English copy for in-app tooltips and empty-state explainers.
 * Single source of truth — both <HelpTip> and <EmptyStateLearn> read from here.
 */

export type TermKey =
  | "valuation_cap"
  | "discount"
  | "mfn"
  | "post_money"
  | "pre_money"
  | "pro_rata"
  | "pool_topup"
  | "pool_topup_target"
  | "pool_topup_fixed_shares"
  | "pool_topup_fixed_percent"
  | "conversion_ordering"
  | "cap_denom_method"
  | "pre_money_denom_method"
  | "pre_money_valuation"
  | "new_money"
  | "price_per_share"
  | "fully_diluted"
  | "best_for_investor"
  | "round_type"
  | "stakeholder"
  | "security_class"
  | "option_grant"
  | "convertible_note";

export const TERMS: Record<TermKey, { label: string; short: string }> = {
  valuation_cap: {
    label: "Valuation cap",
    short:
      "The maximum company valuation used to price a SAFE or note when it converts. Lower cap → investor gets more shares per dollar. Without a cap, the SAFE just converts at the round price.",
  },
  discount: {
    label: "Discount",
    short:
      "A percent off the next round's share price. A 20% discount means the SAFE/note converts at 80% of the priced-round price. Often combined with a cap — whichever produces more shares for the investor wins.",
  },
  mfn: {
    label: "MFN — Most Favored Nation",
    short:
      "A clause that lets this investor adopt the better terms of any later SAFE/note signed before the next priced round. Used when there's no cap or discount yet — terms are inherited from whoever the company gives a better deal to next.",
  },
  post_money: {
    label: "Post-money SAFE",
    short:
      "Y Combinator's 2018 standard. The valuation cap is computed AFTER the SAFE itself converts, so the investor's percentage is locked at signing — protected from dilution by other SAFEs that convert at the same round.",
  },
  pre_money: {
    label: "Pre-money SAFE",
    short:
      "The original (2013) SAFE format. The cap is measured before this SAFE converts, so adding more SAFEs dilutes everyone including this investor. Mostly replaced by post-money SAFEs today.",
  },
  pro_rata: {
    label: "Pro-rata rights",
    short:
      "The right (not obligation) for this investor to participate in future rounds at the same share price, maintaining their ownership percentage. Doesn't affect this round's math — flagged for your records.",
  },
  pool_topup: {
    label: "Option pool top-up",
    short:
      "New shares added to the option pool as part of this round, typically demanded by the lead investor. The cost of this pool usually comes out of the pre-money valuation, diluting existing shareholders rather than the new investor.",
  },
  pool_topup_target: {
    label: "Target post-money pool %",
    short:
      "Solve for the pool size such that, after the round, the option pool equals this percentage of the post-money fully-diluted shares. Enter as a fraction: 0.10 means 10%.",
  },
  pool_topup_fixed_shares: {
    label: "Fixed share count",
    short:
      "Add this exact number of shares to the option pool. Use when you've already negotiated a specific grant size.",
  },
  pool_topup_fixed_percent: {
    label: "Fixed % of pre-money",
    short:
      "Add a pool sized as this percentage of the pre-money fully-diluted share count. Enter as a fraction: 0.05 means 5%.",
  },
  conversion_ordering: {
    label: "Conversion ordering rule",
    short:
      "The order in which SAFEs, notes, the pool top-up, and new money are issued in the math. Different orderings can produce slightly different ownership percentages because each later issuance dilutes earlier ones. The default (Convertibles → Pool → New Money) follows the most common practitioner approach.",
  },
  cap_denom_method: {
    label: "Cap denominator method",
    short:
      "What share count to divide the valuation cap by, to get the cap-implied price per share. CURRENT_FULLY_DILUTED includes today's options + pool. The post-money SAFE solver iterates to find a self-consistent denominator.",
  },
  pre_money_denom_method: {
    label: "Pre-money denominator method",
    short:
      "What share count to divide the pre-money valuation by, to get the priced-round price per share. CURRENT_FULLY_DILUTED matches what most term sheets use.",
  },
  pre_money_valuation: {
    label: "Pre-money valuation",
    short:
      "What the company is worth before this round's new investment. Pre-money + new money = post-money valuation.",
  },
  new_money: {
    label: "New money",
    short:
      "The dollar amount the new investors will invest in this priced round (separate from any existing SAFEs/notes that convert).",
  },
  price_per_share: {
    label: "Price per share",
    short:
      "The dollar price each share of the new round costs, derived from pre-money valuation ÷ chosen denominator. This is the anchor — every conversion and ownership percentage flows from it.",
  },
  fully_diluted: {
    label: "Fully diluted",
    short:
      "Total shares assuming every option is exercised and every SAFE/note converts. The denominator most investors use to think about ownership percentages.",
  },
  best_for_investor: {
    label: "Best for investor",
    short:
      "When a SAFE/note has both a cap and a discount, the conversion uses whichever method produces more shares for the investor (lower price). This is the standard SAFE/note behavior.",
  },
  round_type: {
    label: "Round type",
    short:
      "Priced round = stock issued at a defined price. New SAFE/note = no price set, will convert later. Accelerator = fixed equity grant (e.g. YC's 7%).",
  },
  stakeholder: {
    label: "Stakeholder",
    short:
      "Anyone who can hold equity in the company — founders, employees, advisors, angels, VCs, accelerators. Stakeholders are the entities that holdings, options, SAFEs, and notes are attached to.",
  },
  security_class: {
    label: "Security class",
    short:
      "A category of share — Common Stock, Seed Preferred, Series A Preferred, an option pool, etc. Holdings are issued against a specific security class.",
  },
  option_grant: {
    label: "Option grant",
    short:
      "An award giving an employee or advisor the right to buy company shares at a fixed strike price, usually subject to vesting. Until exercised, options are dilutive but not voting.",
  },
  convertible_note: {
    label: "Convertible note",
    short:
      "Debt that converts to equity at the next priced round. Like a SAFE but with interest and a maturity date. If the round doesn't happen by maturity, the note may need to be repaid or extended.",
  },
};

export type EntityKey = "safe" | "note" | "option_grant" | "security_class" | "stakeholder" | "holding";

export const ENTITIES: Record<
  EntityKey,
  { title: string; body: string; cta: string }
> = {
  safe: {
    title: "What is a SAFE?",
    body: "A Simple Agreement for Future Equity (SAFE) is a contract that gives an investor the right to receive shares in a future priced round, instead of getting shares now. SAFEs let you raise quickly without negotiating a valuation today. Most SAFEs include a valuation cap, a discount, or both — those determine how many shares the investor will eventually get when conversion happens. Created by Y Combinator in 2013; the post-money variant from 2018 is now the standard.",
    cta: "Add your first SAFE",
  },
  note: {
    title: "What is a convertible note?",
    body: "A convertible note is debt that converts to equity at the next priced round. Like a SAFE, it lets you defer the valuation conversation, but unlike a SAFE it accrues interest and has a maturity date. If the priced round doesn't happen by maturity, the note may need to be repaid, extended, or converted at a default valuation. Notes were the standard before SAFEs and are still common, especially outside the US.",
    cta: "Add your first note",
  },
  option_grant: {
    title: "What is an option grant?",
    body: "An option grant gives an employee, advisor, or contractor the right to buy a fixed number of shares at a fixed price (the strike price), usually over a vesting schedule. Options are how startups compensate people without spending cash. They're dilutive (count toward fully diluted) but the holder has to actually exercise (buy) them to become a shareholder.",
    cta: "Add an option grant",
  },
  security_class: {
    title: "What is a security class?",
    body: "A security class defines a type of share the company can issue — Common Stock, Series Seed Preferred, Series A Preferred, an option pool, a warrant, etc. Each class has its own rights (voting, liquidation preference, conversion). Every holding, option grant, SAFE conversion, and note conversion is issued against a specific security class.",
    cta: "Add a security class",
  },
  stakeholder: {
    title: "What is a stakeholder?",
    body: "A stakeholder is anyone who can hold equity, options, SAFEs, or notes — founders, employees, advisors, angels, VCs, accelerators. You'll add stakeholders before you can issue holdings or instruments to them. The stakeholder type (FOUNDER, EMPLOYEE, etc.) is metadata for filtering and reporting; it doesn't affect the math.",
    cta: "Add your first stakeholder",
  },
  holding: {
    title: "What is an equity holding?",
    body: "A holding is a stock certificate — a record that a stakeholder owns N shares of a specific security class as of a specific issue date. This is the core of your cap table. Founder common shares, investor preferred from a priced round, and converted SAFE shares all show up here.",
    cta: "Issue your first holding",
  },
};
