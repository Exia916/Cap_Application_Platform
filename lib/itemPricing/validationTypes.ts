// lib/itemPricing/validationTypes.ts

import type { PagedResult } from "@/lib/itemPricing/types";

export type ItemPricingValidationStatus = "RUNNING" | "PASSED" | "WARNINGS" | "FAILED";
export type ItemPricingValidationSeverity = "ERROR" | "WARNING";

export type ItemPricingValidationRun = {
  id: string;
  priceBookId: string;
  priceBookCode: string;
  priceBookName: string;
  validationType: string;
  status: ItemPricingValidationStatus;
  itemCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type ItemPricingValidationIssue = {
  id: number;
  validationRunId: string;
  severity: ItemPricingValidationSeverity;
  issueCode: string;
  entityType: string | null;
  entityId: string | null;
  itemId: string | null;
  itemCode: string | null;
  ruleSetId: number | null;
  ruleSetCode: string | null;
  decorationMethodCode: string | null;
  quantityBreakCode: string | null;
  message: string;
  detailsJson: unknown | null;
  createdAt: string;
};

export type ItemPricingValidationRunDetail = ItemPricingValidationRun & {
  issues: ItemPricingValidationIssue[];
};

export type ItemPricingValidationListOptions = {
  priceBookId?: string | null;
  q?: string | null;
  limit?: number | string | null;
  offset?: number | string | null;
  sortBy?: string | null;
  sortDir?: "asc" | "desc" | string | null;
};

export type ItemPricingCreateValidationRunInput = {
  priceBookId?: string | null;
  notes?: string | null;
  includeCalculationCheck?: boolean | null;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

export type ItemPricingValidationPagedResult = PagedResult<ItemPricingValidationRun>;
