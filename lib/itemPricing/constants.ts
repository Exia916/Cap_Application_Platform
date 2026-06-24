// lib/itemPricing/constants.ts

export const ITEM_PRICING_MODULE_NAME = "Item Pricing Setup";
export const ITEM_PRICING_MODULE_KEY = "item-pricing";
export const ITEM_PRICING_ADMIN_BASE_PATH = "/admin/item-pricing";

export const ITEM_PRICING_ENTITY_TYPES = {
  priceBook: "item_pricing_price_book",
  item: "item_pricing_item",
  ruleSet: "item_pricing_rule_set",
  basePrice: "item_pricing_base_price",
  calculatedPrice: "item_pricing_calculated_price",
  importBatch: "item_pricing_import_batch",
  updateBatch: "item_pricing_update_batch",
  exportRun: "item_pricing_export_run",
  validationRun: "item_pricing_validation_run",
  priceLevel: "item_pricing_price_level",
  priceLevelRule: "item_pricing_price_level_rule",
} as const;

export const ITEM_PRICING_ATTACHMENT_CATEGORIES = {
  general: "general",
  sourceWorkbook: "source_workbook",
  pricingGuideline: "pricing_guideline",
  approval: "approval",
  exportReview: "export_review",
} as const;

export const PRICE_BOOK_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;

export const PRICE_BOOK_STATUS_LABELS: Record<(typeof PRICE_BOOK_STATUSES)[number], string> = {
  DRAFT: "Draft",
  REVIEW: "Review",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const ITEM_PRICING_VALIDATION_STATUSES = ["PASSED", "WARNINGS", "FAILED"] as const;

export const ITEM_PRICING_VALIDATION_STATUS_LABELS: Record<(typeof ITEM_PRICING_VALIDATION_STATUSES)[number], string> = {
  PASSED: "Passed",
  WARNINGS: "Warnings",
  FAILED: "Failed",
};

export const ITEM_PRICING_RULE_SET_CODES = [
  "IN_STOCK_CAPS",
  "PREMIUM_LINE",
  "PREMIUM_LINE_KNITS",
  "IN_STOCK_IMPORT_KNITS",
  "IN_STOCK_MADE_USA_KNITS",
  "ELITE_KNITS",
] as const;

export const ITEM_PRICING_DECORATION_METHOD_CODES = [
  "BLANK",
  "FLAT_EMB",
  "THREE_D_EMB",
  "KNIT_IN",
] as const;

export const ITEM_PRICING_QUANTITY_BREAK_CODES = [
  "1_23",
  "15",
  "24",
  "48",
  "96",
  "144",
  "576",
  "2500",
] as const;

export const ITEM_PRICING_BASE_REFERENCES = [
  "BLANK_EQP",
  "FLAT_EQP",
  "THREE_D_EQP",
  "PRIOR_BREAK",
  "KNIT_IN_EQP",
] as const;

export const ITEM_PRICING_PRICE_LEVEL_TYPES = ["INTERNAL", "CUSTOMER_GROUP", "RETAIL", "SPECIAL"] as const;

export const ITEM_PRICING_PRICE_LEVEL_RULE_TYPES = [
  "MULTIPLIER",
  "ADD_AMOUNT",
  "DISCOUNT_PERCENT",
  "OVERRIDE_PRICE",
  "CODED_MULTIPLIER",
] as const;

export const ITEM_PRICING_ROUNDING_MODES = ["NONE", "HALF_UP_2", "CEILING_2", "FLOOR_2"] as const;

export const ITEM_PRICING_PRICE_LEVEL_CODES = [
  "INTERNAL_NET",
  "CODED",
  "DML",
  "PRM",
  "UPA",
  "SPORTS_INC",
  "TOWSLEYS",
  "UNIFIRST",
  "GOLD_BOND",
  "RETAIL_NET",
  "RETAIL_CODED",
] as const;

export const PRICE_LEVEL_RULE_TYPE_LABELS: Record<string, string> = {
  MULTIPLIER: "Multiplier",
  ADD_AMOUNT: "Add Amount",
  DISCOUNT_PERCENT: "Discount Percent",
  OVERRIDE_PRICE: "Override Price",
  CODED_MULTIPLIER: "Coded Multiplier",
};

export const ROUNDING_MODE_LABELS: Record<string, string> = {
  NONE: "No Rounding",
  HALF_UP_2: "Round to 2 Decimals",
  CEILING_2: "Round Up to 2 Decimals",
  FLOOR_2: "Round Down to 2 Decimals",
};

export const RULE_SET_LABELS: Record<string, string> = {
  IN_STOCK_CAPS: "In Stock Caps",
  PREMIUM_LINE: "Premium Line",
  PREMIUM_LINE_KNITS: "Premium Line Knits",
  IN_STOCK_IMPORT_KNITS: "In Stock Import Knits / IKs",
  IN_STOCK_MADE_USA_KNITS: "In Stock Made in USA Knits / RKs",
  ELITE_KNITS: "Elite Knits",
};

export const DECORATION_METHOD_LABELS: Record<string, string> = {
  BLANK: "Blank",
  FLAT_EMB: "Flat Embroidery",
  THREE_D_EMB: "3D Embroidery",
  KNIT_IN: "Knit In",
};

export const QUANTITY_BREAK_LABELS: Record<string, string> = {
  "1_23": "1–23",
  "15": "15",
  "24": "24",
  "48": "48",
  "96": "96",
  "144": "144",
  "576": "576",
  "2500": "2500+",
};

export const BASE_REFERENCE_LABELS: Record<string, string> = {
  BLANK_EQP: "Blank EQP",
  FLAT_EQP: "Flat EQP",
  THREE_D_EQP: "3D EQP",
  PRIOR_BREAK: "Prior Break",
  KNIT_IN_EQP: "Knit In EQP",
};

export const FLAT_EMB_ADDER = 3.0;
export const THREE_D_EMB_ADDER = 5.75;

export const ITEM_PRICING_SPECIAL_ITEM_CODES = {
  premiumNoThreeD: new Set(["I8507"]),
};

export function itemPricingStatusLabel(status: string | null | undefined): string {
  const key = String(status || "").toUpperCase() as keyof typeof PRICE_BOOK_STATUS_LABELS;
  return PRICE_BOOK_STATUS_LABELS[key] || String(status || "");
}

export function itemPricingValidationStatusLabel(status: string | null | undefined): string {
  const key = String(status || "").toUpperCase() as keyof typeof ITEM_PRICING_VALIDATION_STATUS_LABELS;
  return ITEM_PRICING_VALIDATION_STATUS_LABELS[key] || String(status || "");
}

export function itemPricingMethodLabel(code: string | null | undefined): string {
  return DECORATION_METHOD_LABELS[String(code || "").toUpperCase()] || String(code || "");
}

export function itemPricingRuleSetLabel(code: string | null | undefined): string {
  return RULE_SET_LABELS[String(code || "").toUpperCase()] || String(code || "");
}

export function itemPricingQuantityBreakLabel(code: string | null | undefined): string {
  return QUANTITY_BREAK_LABELS[String(code || "")] || String(code || "");
}

export function itemPricingPriceLevelRuleTypeLabel(code: string | null | undefined): string {
  return PRICE_LEVEL_RULE_TYPE_LABELS[String(code || "").toUpperCase()] || String(code || "");
}

export function itemPricingRoundingModeLabel(code: string | null | undefined): string {
  return ROUNDING_MODE_LABELS[String(code || "").toUpperCase()] || String(code || "");
}
