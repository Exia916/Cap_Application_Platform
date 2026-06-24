// lib/itemPricing/importTypes.ts

import type { ItemPricingAuditInput, ItemPricingPriceBook } from "@/lib/itemPricing/types";

export type ItemPricingImportBatchStatus = "STAGED" | "VALIDATED" | "APPLIED" | "FAILED" | "VOIDED";
export type ItemPricingImportRowStatus = "VALID" | "WARNING" | "ERROR" | "APPLIED" | "SKIPPED";

export type ItemPricingImportBatch = {
  id: string;
  priceBookId: string;
  priceBookCode: string;
  priceBookName: string;
  importType: "BASE_PRICE_CSV" | string;
  status: ItemPricingImportBatchStatus | string;
  fileName: string | null;
  sourceSheetName: string | null;
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
};

export type ItemPricingImportRow = {
  id: string;
  batchId: string;
  rowNumber: number;
  itemCode: string | null;
  itemDescription: string | null;
  productFamily: string | null;
  ruleSetCode: string | null;
  ruleSetId: number | null;
  blankEqpPrice: number | null;
  active: boolean | null;
  allowsBlankOverride: boolean | null;
  allowsFlatEmbOverride: boolean | null;
  allows3dEmbOverride: boolean | null;
  allowsKnitInOverride: boolean | null;
  notes: string | null;
  sourceFileName: string | null;
  sourceSheetName: string | null;
  status: ItemPricingImportRowStatus | string;
  errorMessage: string | null;
  warningMessage: string | null;
  existingItemId: string | null;
  appliedItemId: string | null;
  appliedBasePriceId: string | null;
  createdAt: string;
  appliedAt: string | null;
};

export type ItemPricingImportBatchDetail = ItemPricingImportBatch & {
  priceBook?: ItemPricingPriceBook | null;
  rows: ItemPricingImportRow[];
};

export type ItemPricingStageCsvImportInput = ItemPricingAuditInput & {
  priceBookId?: string | null;
  csvText?: string | null;
  fileName?: string | null;
  sourceSheetName?: string | null;
  notes?: string | null;
};

export type ItemPricingApplyImportInput = ItemPricingAuditInput & {
  batchId: string;
  saveCalculatedSnapshots?: boolean | string | null;
};

export type ParsedItemPricingImportRow = {
  rowNumber: number;
  itemCode: string | null;
  itemDescription: string | null;
  productFamily: string | null;
  ruleSetCode: string | null;
  blankEqpPriceRaw: string | null;
  activeRaw: string | null;
  allowsBlankOverrideRaw: string | null;
  allowsFlatEmbOverrideRaw: string | null;
  allows3dEmbOverrideRaw: string | null;
  allowsKnitInOverrideRaw: string | null;
  notes: string | null;
};

export type ItemPricingImportCounts = {
  rowCount: number;
  validRowCount: number;
  warningRowCount: number;
  errorRowCount: number;
  appliedRowCount?: number;
  skippedRowCount?: number;
  snapshotErrorCount?: number;
};
