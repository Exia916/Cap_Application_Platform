// lib/itemPricing/priceLevelTypes.ts

import type { ItemPricingCalculationPreviewInput, ItemPricingCalculationResult } from "@/lib/itemPricing/types";
import type {
  ITEM_PRICING_PRICE_LEVEL_RULE_TYPES,
  ITEM_PRICING_PRICE_LEVEL_TYPES,
  ITEM_PRICING_ROUNDING_MODES,
} from "@/lib/itemPricing/constants";

export type ItemPricingPriceLevelType = (typeof ITEM_PRICING_PRICE_LEVEL_TYPES)[number];
export type ItemPricingPriceLevelRuleType = (typeof ITEM_PRICING_PRICE_LEVEL_RULE_TYPES)[number];
export type ItemPricingRoundingMode = (typeof ITEM_PRICING_ROUNDING_MODES)[number];

export type ItemPricingPriceLevel = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  levelType: ItemPricingPriceLevelType | string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  ruleCount?: number;
  activeRuleCount?: number;
};

export type ItemPricingPriceLevelRule = {
  id: string;
  priceLevelId: string;
  priceLevelCode: string;
  priceLevelName: string;
  ruleSetId: number | null;
  ruleSetCode: string | null;
  ruleSetName: string | null;
  decorationMethodId: number | null;
  decorationMethodCode: string | null;
  decorationMethodName: string | null;
  quantityBreakId: number | null;
  quantityBreakCode: string | null;
  quantityBreakLabel: string | null;
  ruleType: ItemPricingPriceLevelRuleType | string;
  multiplier: number | null;
  addAmount: number | null;
  percentValue: number | null;
  overridePrice: number | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  roundingMode: ItemPricingRoundingMode | string;
  calculationOrder: number;
  active: boolean;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type ItemPricingPriceLevelDetail = ItemPricingPriceLevel & {
  rules: ItemPricingPriceLevelRule[];
};

export type ItemPricingPriceLevelInput = {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  levelType?: string | null;
  active?: boolean | string | null;
  sortOrder?: number | string | null;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

export type ItemPricingPriceLevelRuleInput = {
  ruleSetId?: number | string | null;
  decorationMethodId?: number | string | null;
  quantityBreakId?: number | string | null;
  ruleType?: string | null;
  multiplier?: number | string | null;
  addAmount?: number | string | null;
  percentValue?: number | string | null;
  overridePrice?: number | string | null;
  minimumPrice?: number | string | null;
  maximumPrice?: number | string | null;
  roundingMode?: string | null;
  calculationOrder?: number | string | null;
  active?: boolean | string | null;
  notes?: string | null;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

export type ItemPricingPriceLevelListOptions = {
  q?: string | null;
  includeInactive?: boolean | string | null;
  sortBy?: string | null;
  sortDir?: "asc" | "desc" | string | null;
  limit?: number | string | null;
  offset?: number | string | null;
};

export type ItemPricingPriceLevelPreviewInput = ItemPricingCalculationPreviewInput & {
  priceLevelId?: string | null;
};

export type ItemPricingPriceLevelBreakPrice = {
  quantityBreakId: number;
  quantityBreakCode: string;
  quantityBreakLabel: string;
  minQty: number;
  maxQty: number | null;
  sortOrder: number;
  basePrice: number;
  finalPrice: number;
  appliedRules: Array<{
    ruleId: string;
    ruleType: string;
    label: string;
    before: number;
    after: number;
  }>;
};

export type ItemPricingPriceLevelMethodPrices = {
  decorationMethodId: number;
  methodCode: string;
  methodName: string;
  prices: ItemPricingPriceLevelBreakPrice[];
};

export type ItemPricingPriceLevelPreviewResult = {
  baseCalculation: ItemPricingCalculationResult;
  priceLevel: ItemPricingPriceLevel;
  methods: ItemPricingPriceLevelMethodPrices[];
  warnings: string[];
  errors: string[];
};
