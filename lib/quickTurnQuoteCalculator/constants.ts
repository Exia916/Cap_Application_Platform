// lib/quickTurnQuoteCalculator/constants.ts

export const QUICK_TURN_QUOTE_ENTITY_TYPE = "quick_turn_quote";

export const QUICK_TURN_QUOTE_DISCLAIMER =
  "Quote pricing is valid for 30 days from the generated date and is subject to review after expiration.";

export const QUICK_TURN_FINAL_BREAK_NOTE =
  "Upper management review recommended for this quantity range.";

export const QUICK_TURN_DEFAULT_PROGRAM_CODE = "QUICK_TURN";
export const QUICK_TURN_DEFAULT_FACTORY_CODE = "JF";

export const QUICK_TURN_CALCULATOR_CODES = {
  STANDARD_QT: "STANDARD_QT",
  DDP_MO_AIR_QT: "DDP_MO_AIR_QT",
  DDP_DIRECT_AIR_QT: "DDP_DIRECT_AIR_QT",
} as const;

export type QuickTurnCalculatorCode =
  (typeof QUICK_TURN_CALCULATOR_CODES)[keyof typeof QUICK_TURN_CALCULATOR_CODES];

export const QUICK_TURN_QUANTITY_BREAK_LABELS = [
  "1–72",
  "73–144",
  "145–300",
  "301–576",
  "577–1008",
  "1009–2508",
  "2509–5004",
  "5005–10008+",
] as const;

export type QuickTurnAccessoryCategory = "DECORATION" | "CLOSURE";

export const QUICK_TURN_ACCESSORY_CATEGORIES = {
  DECORATION: "DECORATION",
  CLOSURE: "CLOSURE",
} as const;

export type QuickTurnPricingMethod =
  | "FLAT_PER_UNIT"
  | "PER_1000_STITCHES"
  | "BASE_PLUS_EMBROIDERY_STITCHES"
  | "PER_COLOR"
  | "PRINTED_APPLIQUE"
  | "PER_PANEL_PER_COLOR"
  | "PER_PANEL"
  | "PER_ROW"
  | "FLAT_WITH_MERROWED"
  | "EMBROIDERY_WITH_MERROWED_AND_STITCHES"
  | "PRINTED_PATCH_WITH_MERROWED";

export const QUICK_TURN_EMBROIDERY_TYPE_ACCESSORY_CODES = {
  FLAT_EMBROIDERY: "FLAT_EMBROIDERY",
  THREE_D_EMBROIDERY: "3_D_EMBROIDERY",
} as const;
