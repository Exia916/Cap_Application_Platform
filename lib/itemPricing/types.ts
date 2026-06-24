// lib/itemPricing/types.ts

import type {
  ITEM_PRICING_BASE_REFERENCES,
  ITEM_PRICING_DECORATION_METHOD_CODES,
  ITEM_PRICING_QUANTITY_BREAK_CODES,
  ITEM_PRICING_RULE_SET_CODES,
  PRICE_BOOK_STATUSES,
} from "@/lib/itemPricing/constants";

export type PriceBookStatus = (typeof PRICE_BOOK_STATUSES)[number];
export type ItemPricingRuleSetCode = (typeof ITEM_PRICING_RULE_SET_CODES)[number];
export type DecorationMethodCode = (typeof ITEM_PRICING_DECORATION_METHOD_CODES)[number];
export type QuantityBreakCode = (typeof ITEM_PRICING_QUANTITY_BREAK_CODES)[number];
export type BaseReference = (typeof ITEM_PRICING_BASE_REFERENCES)[number];
export type SortDir = "asc" | "desc";

export type ItemPricingAuditInput = {
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

export type ItemPricingPriceBook = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: PriceBookStatus;
  effectiveDate: string | null;
  expirationDate: string | null;
  isDefault: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  itemCount?: number;
};

export type ItemPricingPriceBookInput = ItemPricingAuditInput & {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  isDefault?: boolean | string | null;
};

export type ItemPricingRuleSet = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  allowsBlank: boolean;
  allowsFlatEmb: boolean;
  allows3dEmb: boolean;
  allowsKnitIn: boolean;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type ItemPricingRuleSetInput = ItemPricingAuditInput & {
  name?: string | null;
  description?: string | null;
  allowsBlank?: boolean | string | null;
  allowsFlatEmb?: boolean | string | null;
  allows3dEmb?: boolean | string | null;
  allowsKnitIn?: boolean | string | null;
  sortOrder?: number | string | null;
  active?: boolean | string | null;
};

export type ItemPricingDecorationMethod = {
  id: number;
  code: DecorationMethodCode | string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
};

export type ItemPricingQuantityBreak = {
  id: number;
  code: QuantityBreakCode | string;
  label: string;
  minQty: number;
  maxQty: number | null;
  sortOrder: number;
  active: boolean;
};

export type ItemPricingRuleRow = {
  id: string;
  ruleSetId: number;
  ruleSetCode: string;
  ruleSetName: string;
  decorationMethodId: number;
  decorationMethodCode: DecorationMethodCode | string;
  decorationMethodName: string;
  quantityBreakId: number;
  quantityBreakCode: QuantityBreakCode | string;
  quantityBreakLabel: string;
  minQty: number;
  maxQty: number | null;
  quantityBreakSortOrder: number;
  baseReference: BaseReference | string;
  priorQuantityBreakId: number | null;
  priorQuantityBreakCode: string | null;
  priorQuantityBreakLabel: string | null;
  adderAmount: number;
  calculationOrder: number;
  active: boolean;
  notes: string | null;
};

export type ItemPricingRuleSetDetail = ItemPricingRuleSet & {
  ruleRows: ItemPricingRuleRow[];
};

export type ItemPricingItem = {
  id: string;
  itemCode: string;
  itemDescription: string | null;
  productFamily: string | null;
  ruleSetId: number;
  ruleSetCode: string;
  ruleSetName: string;
  active: boolean;
  allowsBlankOverride: boolean | null;
  allowsFlatEmbOverride: boolean | null;
  allows3dEmbOverride: boolean | null;
  allowsKnitInOverride: boolean | null;
  allowsBlank: boolean;
  allowsFlatEmb: boolean;
  allows3dEmb: boolean;
  allowsKnitIn: boolean;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  blankEqpPrice?: number | null;
};

export type ItemPricingItemInput = ItemPricingAuditInput & {
  itemCode?: string | null;
  itemDescription?: string | null;
  productFamily?: string | null;
  ruleSetId?: number | string | null;
  ruleSetCode?: string | null;
  active?: boolean | string | null;
  allowsBlankOverride?: boolean | string | null;
  allowsFlatEmbOverride?: boolean | string | null;
  allows3dEmbOverride?: boolean | string | null;
  allowsKnitInOverride?: boolean | string | null;
  notes?: string | null;
};

export type ItemPricingBasePrice = {
  id: string;
  priceBookId: string;
  priceBookCode: string;
  priceBookName: string;
  itemId: string;
  itemCode: string;
  itemDescription: string | null;
  ruleSetId: number;
  ruleSetCode: string;
  ruleSetName: string;
  blankEqpPrice: number;
  flatEqpPrice: number | null;
  threeDEqpPrice: number | null;
  sourceFileName: string | null;
  sourceSheetName: string | null;
  sourceRowNumber: number | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type ItemPricingBasePriceInput = ItemPricingAuditInput & {
  priceBookId?: string | null;
  itemId?: string | null;
  itemCode?: string | null;
  blankEqpPrice?: number | string | null;
  sourceFileName?: string | null;
  sourceSheetName?: string | null;
  sourceRowNumber?: number | string | null;
  notes?: string | null;
};

export type ItemPricingListOptions = {
  q?: string | null;
  includeInactive?: boolean | string | null;
  includeVoided?: boolean | string | null;
  priceBookId?: string | null;
  ruleSetId?: number | string | null;
  sortBy?: string | null;
  sortDir?: SortDir | string | null;
  limit?: number | string | null;
  offset?: number | string | null;
};

export type PagedResult<T> = {
  rows: T[];
  total: number;
  pageSize: number;
  offset: number;
};

export type ItemPricingAllowedMethods = {
  blank: boolean;
  flatEmb: boolean;
  threeDEmb: boolean;
  knitIn: boolean;
};

export type CalculationTrace = {
  baseReference: string;
  baseAmount: number;
  adderAmount: number;
  result: number;
  formulaLabel: string;
  priorQuantityBreakCode?: string | null;
  priorQuantityBreakLabel?: string | null;
  sourceRuleId: string;
};

export type CalculatedBreakPrice = {
  quantityBreakId: number;
  quantityBreakCode: string;
  quantityBreakLabel: string;
  minQty: number;
  maxQty: number | null;
  sortOrder: number;
  calculatedPrice: number;
  trace: CalculationTrace;
};

export type CalculatedMethodPrices = {
  decorationMethodId: number;
  methodCode: string;
  methodName: string;
  prices: CalculatedBreakPrice[];
};

export type ItemPricingCalculationInput = {
  priceBookId?: string | null;
  priceBookCode?: string | null;
  itemId?: string | null;
  itemCode?: string | null;
  itemDescription?: string | null;
  itemActive?: boolean;
  ruleSetId: number;
  ruleSetCode: string;
  ruleSetName: string;
  ruleSetActive: boolean;
  blankEqpPrice: number | string | null | undefined;
  allowedMethods: ItemPricingAllowedMethods;
  requestedMethodCode?: DecorationMethodCode | string | null;
  ruleRows: ItemPricingRuleRow[];
};

export type ItemPricingCalculationResult = {
  priceBook: {
    id: string | null;
    code: string | null;
  };
  item: {
    id: string | null;
    itemCode: string | null;
    itemDescription: string | null;
    active: boolean;
  };
  ruleSet: {
    id: number;
    code: string;
    name: string;
    active: boolean;
  };
  blankEqpPrice: number | null;
  flatEqpPrice: number | null;
  threeDEqpPrice: number | null;
  methods: CalculatedMethodPrices[];
  warnings: string[];
  errors: string[];
};

export type ItemPricingCalculationPreviewInput = ItemPricingAuditInput & {
  priceBookId?: string | null;
  itemId?: string | null;
  itemCode?: string | null;
  blankEqpPriceOverride?: number | string | null;
  requestedMethodCode?: DecorationMethodCode | string | null;
};
