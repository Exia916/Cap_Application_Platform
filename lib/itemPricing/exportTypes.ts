// lib/itemPricing/exportTypes.ts

export const ITEM_PRICING_EXPORT_TYPES = [
  "BASE_PRICING_CSV",
  "BASE_PRICING_PDF",
  "ITEM_DETAIL_PDF",
  "PRICE_BOOK_SUMMARY_PDF",
] as const;

export type ItemPricingExportType = (typeof ITEM_PRICING_EXPORT_TYPES)[number];

export type ItemPricingExportFileFormat = "CSV" | "PDF";

export type ItemPricingExportFilters = {
  q?: string | null;
  ruleSetId?: number | string | null;
  ruleSetCode?: string | null;
  itemId?: string | null;
  itemCodeStartsWith?: string | null;
  includeInactive?: boolean | string | null;
  onlyWithBasePrice?: boolean | string | null;
  maxRows?: number | string | null;
};

export type ItemPricingGenerateExportInput = {
  priceBookId?: string | null;
  exportType?: ItemPricingExportType | string | null;
  filters?: ItemPricingExportFilters | null;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

export type ItemPricingExportRun = {
  id: string;
  priceBookId: string;
  priceBookCode: string;
  priceBookName: string;
  exportType: ItemPricingExportType | string;
  fileName: string;
  fileFormat: ItemPricingExportFileFormat | string;
  filtersJson: ItemPricingExportFilters;
  rowCount: number;
  status: string;
  csvContent?: string | null;
  pdfContentBase64?: string | null;
  contentMimeType?: string | null;
  contentSizeBytes?: number | null;
  errorMessage: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type ItemPricingExportRunListOptions = {
  q?: string | null;
  priceBookId?: string | null;
  exportType?: string | null;
  fileFormat?: string | null;
  sortBy?: string | null;
  sortDir?: "asc" | "desc" | string | null;
  limit?: number | string | null;
  offset?: number | string | null;
};

export type ItemPricingExportSourceRow = {
  itemId: string;
  itemCode: string;
  itemDescription: string | null;
  ruleSetId: number;
  ruleSetCode: string;
  ruleSetName: string;
  active: boolean;
  blankEqpPrice: number | null;
};
