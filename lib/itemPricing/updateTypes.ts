// lib/itemPricing/updateTypes.ts

import type { ItemPricingAuditInput, PagedResult, SortDir } from "@/lib/itemPricing/types";

export const ITEM_PRICING_UPDATE_TYPES = [
  "INDIVIDUAL_ITEM",
  "FILTERED_ITEMS",
  "CSV_UPLOAD",
  "WHOLE_PRICE_BOOK",
] as const;

export const ITEM_PRICING_UPDATE_ADJUSTMENT_TYPES = [
  "SET_PRICE",
  "ADD_AMOUNT",
  "PERCENT_CHANGE",
] as const;

export const ITEM_PRICING_UPDATE_BATCH_STATUSES = [
  "DRAFT",
  "VALIDATED",
  "APPLIED",
  "FAILED",
  "VOIDED",
] as const;

export type ItemPricingUpdateType = (typeof ITEM_PRICING_UPDATE_TYPES)[number];
export type ItemPricingUpdateAdjustmentType = (typeof ITEM_PRICING_UPDATE_ADJUSTMENT_TYPES)[number];
export type ItemPricingUpdateBatchStatus = (typeof ITEM_PRICING_UPDATE_BATCH_STATUSES)[number];

export type ItemPricingUpdateCriteria = {
  ruleSetId?: number | string | null;
  ruleSetCode?: string | null;
  includeInactive?: boolean | string | null;
  itemCodeStartsWith?: string | null;
};

export type ItemPricingUpdateInputRow = {
  itemId?: string | null;
  itemCode?: string | null;
  newBlankEqp?: number | string | null;
  newBlankEqpPrice?: number | string | null;
  blankEqpPrice?: number | string | null;
};

export type ItemPricingUpdateBatch = {
  id: string;
  batchNumber: string;
  priceBookId: string;
  priceBookCode: string;
  priceBookName: string;
  name: string;
  updateType: ItemPricingUpdateType | string;
  adjustmentType: ItemPricingUpdateAdjustmentType | string;
  adjustmentValue: number | null;
  criteriaJson: ItemPricingUpdateCriteria | Record<string, unknown>;
  status: ItemPricingUpdateBatchStatus | string;
  notes: string | null;
  rowCount: number;
  validRowCount: number;
  warningRowCount: number;
  errorRowCount: number;
  appliedRowCount: number;
  skippedRowCount: number;
  snapshotErrorCount: number;
  createdAt: string;
  createdBy: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  appliedAt: string | null;
  appliedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type ItemPricingUpdateBatchRow = {
  id: string;
  batchId: string;
  rowNumber: number;
  itemId: string | null;
  itemCode: string | null;
  itemDescription: string | null;
  ruleSetId: number | null;
  ruleSetCode: string | null;
  oldBlankEqp: number | null;
  newBlankEqp: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  oldFlatEqp: number | null;
  newFlatEqp: number | null;
  old3dEqp: number | null;
  new3dEqp: number | null;
  status: string;
  warningMessage: string | null;
  errorMessage: string | null;
  createdAt: string;
  appliedAt: string | null;
};

export type ItemPricingUpdateBatchDetail = ItemPricingUpdateBatch & {
  rows: ItemPricingUpdateBatchRow[];
};

export type ItemPricingUpdateBatchListOptions = {
  q?: string | null;
  priceBookId?: string | null;
  status?: string | null;
  sortBy?: string | null;
  sortDir?: SortDir | string | null;
  limit?: number | string | null;
  offset?: number | string | null;
};

export type ItemPricingCreateUpdateBatchInput = ItemPricingAuditInput & {
  priceBookId?: string | null;
  name?: string | null;
  updateType?: string | null;
  adjustmentType?: string | null;
  adjustmentValue?: number | string | null;
  criteria?: ItemPricingUpdateCriteria | null;
  rows?: ItemPricingUpdateInputRow[] | null;
  csvText?: string | null;
  notes?: string | null;
};

export type ItemPricingApplyUpdateBatchInput = ItemPricingAuditInput & {
  batchId?: string | null;
  saveCalculatedSnapshots?: boolean | string | null;
};

export type ItemPricingUpdateBatchPagedResult = PagedResult<ItemPricingUpdateBatch>;

export const ITEM_PRICING_UPDATE_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_ITEM: "Individual Item",
  FILTERED_ITEMS: "Filtered Items",
  CSV_UPLOAD: "CSV Upload",
  WHOLE_PRICE_BOOK: "Whole Price Book",
};

export const ITEM_PRICING_UPDATE_ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  SET_PRICE: "Set Price",
  ADD_AMOUNT: "Add Amount",
  PERCENT_CHANGE: "Percent Change",
};
