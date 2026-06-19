// lib/repositories/quickTurnQuoteCustomerExportRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { getSavedQuickTurnQuoteById } from "@/lib/repositories/quickTurnQuoteCalculatorRepo";
import { QUICK_TURN_QUOTE_ENTITY_TYPE } from "@/lib/quickTurnQuoteCalculator/constants";

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

export type QuickTurnCustomerOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  isActive: boolean;
};

export type QuickTurnCustomerExportSelectedBreak = {
  resultId: string;
  calculatorCode: string;
  calculatorName: string;
  calculatorRouteType: string;
  breakLabel: string;
  quantityLabel: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  managementReviewRequired: boolean;
};

export type QuickTurnCustomerExportItemInput = {
  quoteItemId: string;
  optionLabel?: string | null;
  customerDescription?: string | null;
  customerNotes?: string | null;
  factoryDisplay?: string | null;
  selectedBreakResultIds?: string[] | null;
  selectedBreaks?: Array<Partial<QuickTurnCustomerExportSelectedBreak>> | null;
  selectedMethodCode?: string | null;
  imageAttachmentId?: number | string | null;
  sortOrder?: number | string | null;
};

export type QuickTurnCustomerExportInput = {
  selectedCalculatorId?: number | string | null;
  selectedCalculatorCode?: string | null;
  preparedForCustomerId?: string | null;
  quotePreparedForDisplay?: string | null;
  workflowSalesOrderNumber?: string | null;
  programLogoText?: string | null;
  capProgramName?: string | null;
  customerServiceContact?: string | null;
  sampleProductionDetails?: string | null;
  productionTimeDetails?: string | null;
  fob?: string | null;
  additionalInformation?: string | null;
  items?: QuickTurnCustomerExportItemInput[];
};

export type QuickTurnCustomerExportAuditInput = {
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

export type QuickTurnCustomerExportAttachment = {
  id: number;
  originalFileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  uploadedByName: string | null;
  canPreviewInline: boolean;
};

export type QuickTurnCustomerExportOneTimeFee = {
  id: string;
  feeCode: string;
  feeName: string;
  amount: number;
  notes: string | null;
  sortOrder: number;
};

export type QuickTurnCustomerExportItem = {
  id: string | null;
  quoteItemId: string;
  sortOrder: number;
  baseItemCode: string;
  baseItemDescription: string | null;
  isCustomCap: boolean;
  customCapDescription: string | null;
  optionLabel: string;
  customerDescription: string | null;
  customerNotes: string | null;
  factoryDisplay: string | null;
  selectedMethodCode: string | null;
  selectedBreaks: QuickTurnCustomerExportSelectedBreak[];
  oneTimeFees: QuickTurnCustomerExportOneTimeFee[];
  imageAttachmentId: number | null;
  imageAttachment: QuickTurnCustomerExportAttachment | null;
  imageAttachmentCategory: string;
  availableImageAttachments: QuickTurnCustomerExportAttachment[];
  availableBreaks: QuickTurnCustomerExportSelectedBreak[];
};

export type QuickTurnCustomerExportDetail = {
  exists: boolean;
  id: string | null;
  quoteId: string;
  quoteNumber: string;
  quoteName: string;
  quoteStatus: "DRAFT" | "PUBLISHED";
  isVoided: boolean;
  voidReason: string | null;
  generatedAt: string;
  validUntil: string;
  selectedCalculatorId: number | null;
  selectedCalculatorCode: string | null;
  selectedCalculatorName: string | null;
  availableCalculators: Array<{ id: number | null; code: string; name: string }>;
  preparedForCustomerId: string | null;
  preparedForCustomerCodeSnapshot: string | null;
  preparedForCustomerNameSnapshot: string | null;
  quotePreparedForDisplay: string | null;
  workflowSalesOrderNumber: string | null;
  overseasCustomerServiceNameSnapshot?: string | null;
  quoteRebateRate?: number | null;
  programLogoText: string | null;
  capProgramName: string;
  customerServiceContact: string | null;
  sampleProductionDetails: string | null;
  productionTimeDetails: string | null;
  fob: string;
  additionalInformation: string | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  items: QuickTurnCustomerExportItem[];
};

type ExportHeaderRow = {
  id: string;
  quoteId: string;
  selectedCalculatorId: number | null;
  selectedCalculatorCode: string | null;
  selectedCalculatorName: string | null;
  preparedForCustomerId: string | null;
  preparedForCustomerCodeSnapshot: string | null;
  preparedForCustomerNameSnapshot: string | null;
  quotePreparedForDisplay: string | null;
  workflowSalesOrderNumber: string | null;
  overseasCustomerServiceNameSnapshot?: string | null;
  quoteRebateRate?: number | null;
  programLogoText: string | null;
  capProgramName: string;
  customerServiceContact: string | null;
  sampleProductionDetails: string | null;
  productionTimeDetails: string | null;
  fob: string;
  additionalInformation: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  exportSnapshot: unknown;
};

type ExportItemRow = {
  id: string;
  exportId: string;
  quoteItemId: string;
  optionLabel: string | null;
  customerDescription: string | null;
  customerNotes: string | null;
  factoryDisplay: string | null;
  selectedBreaks: unknown;
  selectedMethodCode: string | null;
  imageAttachmentId: number | null;
  sortOrder: number;
};

function exportItemRowQuality(row: ExportItemRow) {
  return (
    parseBreaks(row.selectedBreaks).length * 10 +
    (row.imageAttachmentId ? 4 : 0) +
    (cleanText(row.customerDescription) ? 2 : 0) +
    (cleanText(row.customerNotes) ? 1 : 0)
  );
}

function putBestRow(map: Map<string | number, ExportItemRow>, key: string | number, row: ExportItemRow) {
  const current = map.get(key);
  if (!current || exportItemRowQuality(row) >= exportItemRowQuality(current)) {
    map.set(key, row);
  }
}

function mapExportRowsByQuoteItemId(rows: ExportItemRow[]) {
  const map = new Map<string, ExportItemRow>();
  for (const row of rows) putBestRow(map, row.quoteItemId, row);
  return map;
}

function mapExportRowsBySortOrder(rows: ExportItemRow[]) {
  const map = new Map<number, ExportItemRow>();
  for (const row of rows) putBestRow(map, Number(row.sortOrder ?? 0), row);
  return map;
}

const DEFAULT_SAMPLE_PRODUCTION = "Please allow 5-8 days for sample Photos for approval.";
const DEFAULT_PRODUCTION_TIME = "Approx. 30-35 days for delivery to the final destination within the U.S.";
const DEFAULT_FOB = "1 U.S. Final Destination";
const DEFAULT_CAP_PROGRAM_NAME = "Quick Turn";
const DEFAULT_ADDITIONAL_INFORMATION =
  "Thank you for giving us the opportunity to quote your project! This quote reflects the current tariff rate structure. In the event that tariffs increase or decrease during the course of your order, final pricing adjustments will need to be made.";

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function cleanRequiredText(value: unknown, label: string): string {
  const s = cleanText(value);
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

function cleanOptionalUuid(value: unknown): string | null {
  const s = cleanText(value);
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

function cleanOptionalBigintId(value: unknown): string | null {
  const s = cleanText(value);
  if (!s) return null;
  return /^\d+$/.test(s) ? s : null;
}

function cleanOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function cleanSortOrder(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseBreaks(value: unknown): QuickTurnCustomerExportSelectedBreak[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row: any) => ({
      resultId: String(row?.resultId || ""),
      calculatorCode: String(row?.calculatorCode || ""),
      calculatorName: String(row?.calculatorName || ""),
      calculatorRouteType: String(row?.calculatorRouteType || ""),
      breakLabel: String(row?.breakLabel || ""),
      quantityLabel: String(row?.quantityLabel || row?.breakLabel || ""),
      minQuantity: Number(row?.minQuantity ?? 0),
      maxQuantity: row?.maxQuantity === null || row?.maxQuantity === undefined ? null : Number(row.maxQuantity),
      unitPrice: Number(row?.unitPrice ?? 0),
      managementReviewRequired: !!row?.managementReviewRequired,
    }))
    .filter((row) => row.resultId && row.calculatorCode && row.breakLabel && Number.isFinite(row.unitPrice));
}

function snapshotItems(value: unknown): any[] {
  const root = value && typeof value === "object" ? (value as any) : null;
  return Array.isArray(root?.items) ? root.items : [];
}

function sameBreakIdentity(a: QuickTurnCustomerExportSelectedBreak, b: QuickTurnCustomerExportSelectedBreak) {
  if (a.resultId && b.resultId && a.resultId === b.resultId) return true;
  if (a.calculatorCode && b.calculatorCode && a.calculatorCode !== b.calculatorCode) return false;
  if (a.breakLabel && b.breakLabel && a.breakLabel === b.breakLabel) return true;
  const sameMin = Number(a.minQuantity ?? -1) === Number(b.minQuantity ?? -2);
  const sameMax = String(a.maxQuantity ?? "") === String(b.maxQuantity ?? "");
  const samePrice = Math.abs(Number(a.unitPrice ?? 0) - Number(b.unitPrice ?? 0)) < 0.0001;
  return sameMin && sameMax && samePrice;
}

function reconcileSelectedBreaksToCurrentResults(
  savedBreaks: QuickTurnCustomerExportSelectedBreak[],
  availableBreaks: QuickTurnCustomerExportSelectedBreak[],
  selectedCalculatorCode: string | null | undefined
): QuickTurnCustomerExportSelectedBreak[] {
  const allowed = availableBreaks.filter((row) => !selectedCalculatorCode || row.calculatorCode === selectedCalculatorCode);
  const used = new Set<string>();
  const reconciled: QuickTurnCustomerExportSelectedBreak[] = [];

  for (const saved of savedBreaks) {
    const current = allowed.find((candidate) => !used.has(candidate.resultId) && sameBreakIdentity(saved, candidate));
    if (current) {
      used.add(current.resultId);
      reconciled.push(current);
    } else {
      reconciled.push(saved);
    }
  }

  return reconciled.sort((a, b) => Number(a.minQuantity ?? 0) - Number(b.minQuantity ?? 0));
}

function imageCategoryForQuoteItem(quoteItemId: string): string {
  return `quick_turn_customer_quote_item_${quoteItemId.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}`;
}

function attachmentSelectSql() {
  return `
    SELECT
      id::bigint AS id,
      original_file_name AS "originalFileName",
      mime_type AS "mimeType",
      file_size_bytes AS "fileSizeBytes",
      created_at AS "createdAt",
      uploaded_by_name AS "uploadedByName",
      CASE
        WHEN COALESCE(mime_type, '') ILIKE 'image/%'
          OR COALESCE(original_file_name, '') ~* '\.(png|jpe?g|gif|webp|bmp|svg)$'
        THEN true
        ELSE false
      END AS "canPreviewInline"
    FROM public.attachments
  `;
}

function quoteDate(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
}

function buildAvailableCalculators(quote: any): Array<{ id: number | null; code: string; name: string }> {
  const map = new Map<string, { id: number | null; code: string; name: string }>();

  for (const item of quote.items ?? []) {
    for (const result of item.results ?? []) {
      const code = String(result.calculatorCode || "");
      if (!code || map.has(code)) continue;
      map.set(code, {
        id: null,
        code,
        name: String(result.calculatorName || code),
      });
    }
  }

  const resultSnapshot = quote.resultSnapshot as any;
  for (const item of resultSnapshot?.items ?? []) {
    for (const calculatorResult of item.calculatorResults ?? []) {
      const calculator = calculatorResult.calculator;
      const code = String(calculator?.code || "");
      if (!code) continue;
      map.set(code, {
        id: calculator?.id == null ? null : Number(calculator.id),
        code,
        name: String(calculator?.name || calculator?.displayLabel || code),
      });
    }
  }

  return Array.from(map.values());
}

function buildAvailableBreaks(quoteItem: any): QuickTurnCustomerExportSelectedBreak[] {
  return (quoteItem.results ?? []).map((result: any) => ({
    resultId: String(result.id),
    calculatorCode: String(result.calculatorCode || ""),
    calculatorName: String(result.calculatorName || ""),
    calculatorRouteType: String(result.calculatorRouteType || ""),
    breakLabel: String(result.breakLabel || ""),
    quantityLabel: String(result.breakLabel || ""),
    minQuantity: Number(result.minQuantity ?? 0),
    maxQuantity: result.maxQuantity === null || result.maxQuantity === undefined ? null : Number(result.maxQuantity),
    unitPrice: Number(result.unitPrice ?? 0),
    managementReviewRequired: !!result.managementReviewRequired,
  }));
}

function buildOneTimeFees(quoteItem: any): QuickTurnCustomerExportOneTimeFee[] {
  return (quoteItem.fees ?? [])
    .map((fee: any, index: number) => ({
      id: String(fee.id ?? `${quoteItem.id}-fee-${index + 1}`),
      feeCode: String(fee.feeCode || "OTHER"),
      feeName: String(fee.feeName || "One-time fee"),
      amount: Number(fee.amount ?? 0),
      notes: cleanText(fee.notes),
      sortOrder: Number.isInteger(Number(fee.sortOrder)) ? Number(fee.sortOrder) : index * 10 + 10,
    }))
    .filter((fee: QuickTurnCustomerExportOneTimeFee) => Number.isFinite(fee.amount) && fee.amount > 0)
    .sort((a: QuickTurnCustomerExportOneTimeFee, b: QuickTurnCustomerExportOneTimeFee) => a.sortOrder - b.sortOrder);
}

function buildDefaultItem(quote: any, quoteItem: any, index: number): QuickTurnCustomerExportItem {
  const customDescription = quoteItem.customCapDescription || quoteItem.baseItemDescription || quoteItem.baseItemCode;
  return {
    id: null,
    quoteItemId: quoteItem.id,
    sortOrder: quoteItem.sortOrder ?? index * 10 + 10,
    baseItemCode: quoteItem.baseItemCode,
    baseItemDescription: quoteItem.baseItemDescription,
    isCustomCap: !!quoteItem.isCustomCap,
    customCapDescription: quoteItem.customCapDescription,
    optionLabel: `Option ${index + 1}`,
    customerDescription: customDescription || null,
    customerNotes: null,
    factoryDisplay: quote.factoryCode || quote.factoryName || null,
    selectedMethodCode: null,
    selectedBreaks: [],
    oneTimeFees: buildOneTimeFees(quoteItem),
    imageAttachmentId: null,
    imageAttachment: null,
    imageAttachmentCategory: imageCategoryForQuoteItem(quoteItem.id),
    availableImageAttachments: [],
    availableBreaks: buildAvailableBreaks(quoteItem),
  };
}

function buildDefaultExport(quote: any): QuickTurnCustomerExportDetail {
  const calculators = buildAvailableCalculators(quote);
  const selected = calculators[0] ?? null;

  return {
    exists: false,
    id: null,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    quoteName: quote.quoteName,
    quoteStatus: quote.quoteStatus,
    isVoided: !!quote.isVoided,
    voidReason: quote.voidReason ?? null,
    generatedAt: quoteDate(quote.generatedAt),
    validUntil: quoteDate(quote.validUntil),
    selectedCalculatorId: selected?.id ?? null,
    selectedCalculatorCode: selected?.code ?? null,
    selectedCalculatorName: selected?.name ?? null,
    availableCalculators: calculators,
    preparedForCustomerId: quote.preparedForCustomerId ?? null,
    preparedForCustomerCodeSnapshot: quote.preparedForCustomerCodeSnapshot ?? null,
    preparedForCustomerNameSnapshot: quote.preparedForCustomerNameSnapshot ?? null,
    quotePreparedForDisplay: quote.quotePreparedForDisplay ?? quote.preparedForCustomerNameSnapshot ?? null,
    workflowSalesOrderNumber: quote.workflowSalesOrderNumber ?? null,
    programLogoText: quote.programLogoText ?? null,
    capProgramName: DEFAULT_CAP_PROGRAM_NAME,
    customerServiceContact: cleanText(quote.overseasCustomerServiceNameSnapshot),
    sampleProductionDetails: DEFAULT_SAMPLE_PRODUCTION,
    productionTimeDetails: DEFAULT_PRODUCTION_TIME,
    fob: quote.fob || DEFAULT_FOB,
    additionalInformation: DEFAULT_ADDITIONAL_INFORMATION,
    createdAt: null,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
    items: (quote.items ?? []).map((item: any, index: number) => buildDefaultItem(quote, item, index)),
  };
}

async function getExportHeader(queryable: Queryable, quoteId: string): Promise<ExportHeaderRow | null> {
  const { rows } = await queryable.query<ExportHeaderRow>(
    `
    SELECT
      e.id,
      e.quote_id AS "quoteId",
      e.selected_calculator_id AS "selectedCalculatorId",
      e.selected_calculator_code AS "selectedCalculatorCode",
      e.selected_calculator_name_snapshot AS "selectedCalculatorName",
      e.prepared_for_customer_id::text AS "preparedForCustomerId",
      e.prepared_for_customer_code_snapshot AS "preparedForCustomerCodeSnapshot",
      e.prepared_for_customer_name_snapshot AS "preparedForCustomerNameSnapshot",
      e.quote_prepared_for_display AS "quotePreparedForDisplay",
      e.workflow_sales_order_number AS "workflowSalesOrderNumber",
      e.program_logo_text AS "programLogoText",
      e.cap_program_name AS "capProgramName",
      e.customer_service_contact AS "customerServiceContact",
      e.sample_production_details AS "sampleProductionDetails",
      e.production_time_details AS "productionTimeDetails",
      e.fob,
      e.additional_information AS "additionalInformation",
      e.created_at AS "createdAt",
      e.created_by AS "createdBy",
      e.updated_at AS "updatedAt",
      e.updated_by AS "updatedBy",
      e.export_snapshot AS "exportSnapshot"
    FROM public.quick_turn_quote_customer_exports e
    WHERE e.quote_id = $1::uuid
    LIMIT 1
    `,
    [quoteId]
  );

  return rows[0] ?? null;
}

async function getExportItems(queryable: Queryable, exportId: string): Promise<ExportItemRow[]> {
  const { rows } = await queryable.query<ExportItemRow>(
    `
    SELECT
      id,
      export_id AS "exportId",
      quote_item_id AS "quoteItemId",
      option_label AS "optionLabel",
      customer_description AS "customerDescription",
      customer_notes AS "customerNotes",
      factory_display AS "factoryDisplay",
      selected_breaks AS "selectedBreaks",
      selected_method_code AS "selectedMethodCode",
      image_attachment_id::bigint AS "imageAttachmentId",
      sort_order AS "sortOrder"
    FROM public.quick_turn_quote_customer_export_items
    WHERE export_id = $1::uuid
    ORDER BY sort_order ASC, created_at ASC, id ASC
    `,
    [exportId]
  );

  return rows;
}

async function listImageAttachmentsForItem(quoteId: string, quoteItemId: string): Promise<QuickTurnCustomerExportAttachment[]> {
  const preferredCategory = imageCategoryForQuoteItem(quoteItemId);
  const { rows } = await db.query<QuickTurnCustomerExportAttachment>(
    `
    ${attachmentSelectSql()}
    WHERE entity_type = $1
      AND entity_id::text = $2::text
      AND COALESCE(is_deleted, false) = false
      AND (
        COALESCE(mime_type, '') ILIKE 'image/%'
        OR COALESCE(original_file_name, '') ~* '\.(png|jpe?g|gif|webp|bmp|svg)$'
      )
    ORDER BY
      CASE WHEN attachment_category = $3 THEN 0 ELSE 1 END,
      created_at DESC,
      id DESC
    LIMIT 100
    `,
    [QUICK_TURN_QUOTE_ENTITY_TYPE, quoteId, preferredCategory]
  );
  return rows;
}

async function getImageAttachmentById(attachmentId: number | null): Promise<QuickTurnCustomerExportAttachment | null> {
  if (!attachmentId) return null;
  const { rows } = await db.query<QuickTurnCustomerExportAttachment>(
    `
    ${attachmentSelectSql()}
    WHERE id = $1::bigint
      AND COALESCE(is_deleted, false) = false
      AND (
        COALESCE(mime_type, '') ILIKE 'image/%'
        OR COALESCE(original_file_name, '') ~* '\.(png|jpe?g|gif|webp|bmp|svg)$'
      )
    LIMIT 1
    `,
    [attachmentId]
  );
  return rows[0] ?? null;
}

async function validateImageAttachmentForQuote(quoteId: string, quoteItemId: string, attachmentId: number): Promise<void> {
  void quoteItemId;

  const { rows } = await db.query<{ id: number }>(
    `
    SELECT id
    FROM public.attachments
    WHERE id = $1::bigint
      AND entity_type = $2
      AND entity_id::text = $3::text
      AND COALESCE(is_deleted, false) = false
      AND (
        COALESCE(mime_type, '') ILIKE 'image/%'
        OR COALESCE(original_file_name, '') ~* '\.(png|jpe?g|gif|webp|bmp|svg)$'
      )
    LIMIT 1
    `,
    [attachmentId, QUICK_TURN_QUOTE_ENTITY_TYPE, quoteId]
  );

  if (!rows[0]) {
    throw new Error("Selected image attachment was not found for this Quick Turn quote.");
  }
}

function selectedCalculatorFromInput(
  input: QuickTurnCustomerExportInput,
  availableCalculators: Array<{ id: number | null; code: string; name: string }>,
  existing?: ExportHeaderRow | null
) {
  const inputCode = cleanText(input.selectedCalculatorCode);
  const inputId = cleanOptionalInteger(input.selectedCalculatorId);

  let selected =
    (inputCode ? availableCalculators.find((x) => x.code === inputCode) : null) ??
    (inputId !== null ? availableCalculators.find((x) => x.id === inputId) : null) ??
    (existing?.selectedCalculatorCode
      ? availableCalculators.find((x) => x.code === existing.selectedCalculatorCode)
      : null) ??
    availableCalculators[0] ??
    null;

  if (!selected) throw new Error("No calculator method is available for this saved quote.");

  return selected;
}

function selectedBreaksFromInput(
  itemInput: QuickTurnCustomerExportItemInput | undefined,
  availableBreaks: QuickTurnCustomerExportSelectedBreak[],
  selectedCalculatorCode: string
): QuickTurnCustomerExportSelectedBreak[] {
  const allowed = availableBreaks.filter((row) => row.calculatorCode === selectedCalculatorCode);
  const allowedById = new Map(allowed.map((row) => [row.resultId, row]));

  const selectedIds = Array.isArray(itemInput?.selectedBreakResultIds)
    ? itemInput!.selectedBreakResultIds.map((x) => String(x)).filter(Boolean)
    : Array.isArray(itemInput?.selectedBreaks)
      ? itemInput!.selectedBreaks.map((x: any) => String(x?.resultId || "")).filter(Boolean)
      : [];

  const uniqueIds = Array.from(new Set(selectedIds));
  const selected: QuickTurnCustomerExportSelectedBreak[] = [];

  for (const id of uniqueIds) {
    const row = allowedById.get(id);
    if (!row) {
      throw new Error("Selected quantity break does not belong to the selected method for this quote item.");
    }
    selected.push(row);
  }

  return selected;
}

function buildExportSnapshot(detail: QuickTurnCustomerExportDetail) {
  return {
    quoteId: detail.quoteId,
    quoteNumber: detail.quoteNumber,
    quoteName: detail.quoteName,
    quoteStatus: detail.quoteStatus,
    selectedCalculatorCode: detail.selectedCalculatorCode,
    selectedCalculatorName: detail.selectedCalculatorName,
    quotePreparedForDisplay: detail.quotePreparedForDisplay,
    preparedForCustomerCodeSnapshot: detail.preparedForCustomerCodeSnapshot,
    preparedForCustomerNameSnapshot: detail.preparedForCustomerNameSnapshot,
    workflowSalesOrderNumber: detail.workflowSalesOrderNumber,
    overseasCustomerServiceNameSnapshot: detail.overseasCustomerServiceNameSnapshot ?? null,
    quoteRebateRate: detail.quoteRebateRate ?? null,
    programLogoText: detail.programLogoText,
    capProgramName: detail.capProgramName,
    customerServiceContact: detail.customerServiceContact,
    sampleProductionDetails: detail.sampleProductionDetails,
    productionTimeDetails: detail.productionTimeDetails,
    fob: detail.fob,
    additionalInformation: detail.additionalInformation,
    items: detail.items.map((item) => ({
      quoteItemId: item.quoteItemId,
      sortOrder: item.sortOrder,
      baseItemCode: item.baseItemCode,
      optionLabel: item.optionLabel,
      customerDescription: item.customerDescription,
      customerNotes: item.customerNotes,
      factoryDisplay: item.factoryDisplay,
      selectedBreaks: item.selectedBreaks,
      oneTimeFees: item.oneTimeFees,
      imageAttachmentId: item.imageAttachmentId,
    })),
  };
}

async function hydrateExport(quote: any, header: ExportHeaderRow | null): Promise<QuickTurnCustomerExportDetail> {
  const defaults = buildDefaultExport(quote);
  if (!header) return defaults;

  const rows = await getExportItems(db, header.id);
  const rowsByQuoteItemId = mapExportRowsByQuoteItemId(rows);
  const rowsBySortOrder = mapExportRowsBySortOrder(rows);
  const snapshotRows = snapshotItems(header.exportSnapshot);
  const snapshotByQuoteItemId = new Map(snapshotRows.map((row: any) => [String(row?.quoteItemId || ""), row]));

  const selectedCalculatorCode = header.selectedCalculatorCode ?? defaults.selectedCalculatorCode;
  const availableCalculators = buildAvailableCalculators(quote);
  const selectedCalculator = selectedCalculatorCode
    ? availableCalculators.find((x) => x.code === selectedCalculatorCode)
    : null;

  const items: QuickTurnCustomerExportItem[] = [];
  for (let index = 0; index < (quote.items ?? []).length; index += 1) {
    const quoteItem = quote.items[index];
    const base = buildDefaultItem(quote, quoteItem, index);
    const exactSaved = rowsByQuoteItemId.get(quoteItem.id) ?? null;
    const sortSaved = rowsBySortOrder.get(Number(base.sortOrder ?? 0)) ?? null;
    const savedCandidates = [exactSaved, sortSaved].filter(Boolean) as ExportItemRow[];
    const saved = savedCandidates.sort((a, b) => exportItemRowQuality(b) - exportItemRowQuality(a))[0] ?? null;
    const snapshot = snapshotByQuoteItemId.get(quoteItem.id) ?? snapshotRows[index] ?? null;
    const imageAttachmentId = saved?.imageAttachmentId ?? cleanOptionalInteger(snapshot?.imageAttachmentId);
    const savedBreaks = parseBreaks(saved?.selectedBreaks ?? snapshot?.selectedBreaks);

    items.push({
      ...base,
      id: saved?.id ?? null,
      optionLabel: saved?.optionLabel || cleanText(snapshot?.optionLabel) || base.optionLabel,
      customerDescription: saved?.customerDescription ?? cleanText(snapshot?.customerDescription) ?? base.customerDescription,
      customerNotes: saved?.customerNotes ?? cleanText(snapshot?.customerNotes) ?? null,
      factoryDisplay: saved?.factoryDisplay ?? cleanText(snapshot?.factoryDisplay) ?? base.factoryDisplay,
      selectedMethodCode: saved?.selectedMethodCode ?? cleanText(snapshot?.selectedMethodCode) ?? null,
      selectedBreaks: reconcileSelectedBreaksToCurrentResults(savedBreaks, base.availableBreaks, selectedCalculatorCode),
      imageAttachmentId,
      imageAttachment: await getImageAttachmentById(imageAttachmentId),
      availableImageAttachments: await listImageAttachmentsForItem(quote.id, quoteItem.id),
    });
  }

  return {
    ...defaults,
    exists: true,
    id: header.id,
    selectedCalculatorId: selectedCalculator?.id ?? header.selectedCalculatorId ?? null,
    selectedCalculatorCode,
    selectedCalculatorName: selectedCalculator?.name ?? header.selectedCalculatorName ?? null,
    availableCalculators,
    preparedForCustomerId: quote.preparedForCustomerId ?? header.preparedForCustomerId,
    preparedForCustomerCodeSnapshot: quote.preparedForCustomerCodeSnapshot ?? header.preparedForCustomerCodeSnapshot,
    preparedForCustomerNameSnapshot: quote.preparedForCustomerNameSnapshot ?? header.preparedForCustomerNameSnapshot,
    quotePreparedForDisplay: quote.quotePreparedForDisplay ?? header.quotePreparedForDisplay,
    workflowSalesOrderNumber: quote.workflowSalesOrderNumber ?? header.workflowSalesOrderNumber ?? null,
    overseasCustomerServiceNameSnapshot: quote.overseasCustomerServiceNameSnapshot ?? null,
    quoteRebateRate: Number.isFinite(Number(quote.quoteRebateRate)) ? Number(quote.quoteRebateRate) : null,
    programLogoText: quote.programLogoText ?? header.programLogoText,
    capProgramName: header.capProgramName || DEFAULT_CAP_PROGRAM_NAME,
    customerServiceContact: header.customerServiceContact ?? cleanText(quote.overseasCustomerServiceNameSnapshot),
    sampleProductionDetails: header.sampleProductionDetails || DEFAULT_SAMPLE_PRODUCTION,
    productionTimeDetails: header.productionTimeDetails || DEFAULT_PRODUCTION_TIME,
    fob: quote.fob || header.fob || DEFAULT_FOB,
    additionalInformation: header.additionalInformation || DEFAULT_ADDITIONAL_INFORMATION,
    createdAt: header.createdAt,
    createdBy: header.createdBy,
    updatedAt: header.updatedAt,
    updatedBy: header.updatedBy,
    items,
  };
}

async function getQuoteForExport(quoteId: string, includeVoided = true) {
  const quote = await getSavedQuickTurnQuoteById(quoteId, { includeVoided });
  if (!quote) throw new Error("Saved Quick Turn quote not found.");
  return quote;
}

async function resolveCustomerSnapshot(customerId?: string | null) {
  const id = cleanOptionalBigintId(customerId);
  if (!id) return { id: null, code: null, name: null };

  const { rows } = await db.query<{ id: string; code: string; name: string }>(
    `
    SELECT id::text, code, name
    FROM public.design_workflow_customers
    WHERE id = $1::bigint
      AND is_active = true
    LIMIT 1
    `,
    [id]
  );

  const row = rows[0];
  if (!row) throw new Error("Selected customer was not found or is inactive.");
  return row;
}

async function logCustomerExportActivity(input: {
  entityId: string;
  eventType: string;
  fieldName?: string | null;
  message: string;
  previousValue?: unknown;
  newValue?: unknown;
  audit: QuickTurnCustomerExportAuditInput;
}) {
  const changedBy = cleanText(input.audit.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(input.audit.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalInteger(input.audit.changedByEmployeeNumber);

  await createActivityHistory({
    entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
    entityId: input.entityId,
    eventType: input.eventType,
    fieldName: input.fieldName ?? null,
    message: input.message,
    module: "Quick Turn Quote Calculator",
    userId: changedByUserId,
    userName: changedBy,
    employeeNumber: changedByEmployeeNumber,
    previousValue: input.previousValue,
    newValue: input.newValue,
  });
}

export async function listQuickTurnQuoteCustomerOptions(q?: string | null): Promise<QuickTurnCustomerOption[]> {
  const search = String(q ?? "").trim();
  const params: any[] = [];
  const where: string[] = ["is_active = true"];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
  }

  const prefixParam = params.length + 1;

  const { rows } = await db.query<QuickTurnCustomerOption>(
    `
    SELECT
      id::text AS id,
      code,
      name,
      CONCAT(code, ' - ', name) AS label,
      is_active AS "isActive"
    FROM public.design_workflow_customers
    WHERE ${where.join(" AND ")}
    ORDER BY
      CASE
        WHEN $${prefixParam}::text IS NOT NULL AND code ILIKE $${prefixParam}::text || '%' THEN 0
        WHEN $${prefixParam}::text IS NOT NULL AND name ILIKE $${prefixParam}::text || '%' THEN 1
        ELSE 2
      END,
      sort_order ASC,
      name ASC
    LIMIT 50
    `,
    [...params, search || null]
  );

  return rows;
}

export async function getQuickTurnCustomerExport(
  quoteId: string,
  opts: { includeVoided?: boolean } = {}
): Promise<QuickTurnCustomerExportDetail> {
  const quote = await getQuoteForExport(quoteId, opts.includeVoided !== false);
  const header = await getExportHeader(db, quoteId);
  return hydrateExport(quote, header);
}

export async function saveQuickTurnCustomerExport(
  quoteId: string,
  input: QuickTurnCustomerExportInput,
  audit: QuickTurnCustomerExportAuditInput
): Promise<QuickTurnCustomerExportDetail> {
  const quote = await getQuoteForExport(quoteId, true);
  if (quote.isVoided) throw new Error("Voided Quick Turn quotes cannot be edited.");

  const existing = await getExportHeader(db, quoteId);
  const availableCalculators = buildAvailableCalculators(quote);
  const selectedCalculator = selectedCalculatorFromInput(input, availableCalculators, existing);
  const selectedCalculatorCode = selectedCalculator.code;
  const customer = {
    id: cleanOptionalBigintId(quote.preparedForCustomerId),
    code: cleanText(quote.preparedForCustomerCodeSnapshot),
    name: cleanText(quote.preparedForCustomerNameSnapshot),
  };

  const changedBy = cleanText(audit.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(audit.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalInteger(audit.changedByEmployeeNumber);

  const workflowSalesOrderNumber = cleanText(quote.workflowSalesOrderNumber) ?? null;
  const quotePreparedForDisplay = cleanText(quote.quotePreparedForDisplay) ?? customer.name ?? existing?.quotePreparedForDisplay ?? null;
  const programLogoText = cleanText(quote.programLogoText);
  const capProgramName = cleanText(input.capProgramName) ?? DEFAULT_CAP_PROGRAM_NAME;
  const fob = cleanText(quote.fob) ?? DEFAULT_FOB;

  const itemInputs = new Map((input.items ?? []).map((item) => [cleanRequiredText(item.quoteItemId, "Quote item"), item]));

  const client = await db.connect();
  try {
    await client.query("BEGIN");


    const headerResult = await client.query<{ id: string }>(
      `
      INSERT INTO public.quick_turn_quote_customer_exports (
        quote_id,
        selected_calculator_id,
        selected_calculator_code,
        selected_calculator_name_snapshot,
        prepared_for_customer_id,
        prepared_for_customer_code_snapshot,
        prepared_for_customer_name_snapshot,
        quote_prepared_for_display,
        workflow_sales_order_number,
        program_logo_text,
        cap_program_name,
        customer_service_contact,
        sample_production_details,
        production_time_details,
        fob,
        additional_information,
        created_by,
        created_by_user_id,
        created_by_employee_number,
        updated_by,
        updated_by_user_id,
        updated_by_employee_number
      )
      VALUES (
        $1::uuid, $2::integer, $3, $4,
        $5::bigint, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18::uuid, $19, $17, $18::uuid, $19
      )
      ON CONFLICT (quote_id) DO UPDATE
      SET selected_calculator_id = EXCLUDED.selected_calculator_id,
          selected_calculator_code = EXCLUDED.selected_calculator_code,
          selected_calculator_name_snapshot = EXCLUDED.selected_calculator_name_snapshot,
          prepared_for_customer_id = EXCLUDED.prepared_for_customer_id,
          prepared_for_customer_code_snapshot = EXCLUDED.prepared_for_customer_code_snapshot,
          prepared_for_customer_name_snapshot = EXCLUDED.prepared_for_customer_name_snapshot,
          quote_prepared_for_display = EXCLUDED.quote_prepared_for_display,
          workflow_sales_order_number = EXCLUDED.workflow_sales_order_number,
          program_logo_text = EXCLUDED.program_logo_text,
          cap_program_name = EXCLUDED.cap_program_name,
          customer_service_contact = EXCLUDED.customer_service_contact,
          sample_production_details = EXCLUDED.sample_production_details,
          production_time_details = EXCLUDED.production_time_details,
          fob = EXCLUDED.fob,
          additional_information = EXCLUDED.additional_information,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_by_employee_number = EXCLUDED.updated_by_employee_number
      RETURNING id
      `,
      [
        quoteId,
        selectedCalculator.id,
        selectedCalculator.code,
        selectedCalculator.name,
        customer.id,
        customer.code,
        customer.name,
        quotePreparedForDisplay,
        workflowSalesOrderNumber,
        programLogoText,
        capProgramName,
        cleanText(input.customerServiceContact),
        cleanText(input.sampleProductionDetails) ?? DEFAULT_SAMPLE_PRODUCTION,
        cleanText(input.productionTimeDetails) ?? DEFAULT_PRODUCTION_TIME,
        fob,
        cleanText(input.additionalInformation) ?? DEFAULT_ADDITIONAL_INFORMATION,
        changedBy,
        changedByUserId,
        changedByEmployeeNumber,
      ]
    );

    const exportId = headerResult.rows[0].id;
    const existingItemRows = await getExportItems(client, exportId);
    const existingItemsByQuoteItemId = mapExportRowsByQuoteItemId(existingItemRows);
    const existingItemsBySortOrder = mapExportRowsBySortOrder(existingItemRows);

    for (let index = 0; index < quote.items.length; index += 1) {
      const quoteItem = quote.items[index];
      const itemInput = itemInputs.get(quoteItem.id);
      const defaults = buildDefaultItem(quote, quoteItem, index);
      const exactExistingItem = existingItemsByQuoteItemId.get(quoteItem.id) ?? null;
      const sortExistingItem = existingItemsBySortOrder.get(Number(defaults.sortOrder ?? 0)) ?? null;
      const existingItemCandidates = [exactExistingItem, sortExistingItem].filter(Boolean) as ExportItemRow[];
      const existingItem = existingItemCandidates.sort((a, b) => exportItemRowQuality(b) - exportItemRowQuality(a))[0] ?? null;
      const selectedBreaks = selectedBreaksFromInput(itemInput, defaults.availableBreaks, selectedCalculatorCode);
      const fallbackBreaks = reconcileSelectedBreaksToCurrentResults(
        parseBreaks(existingItem?.selectedBreaks),
        defaults.availableBreaks,
        selectedCalculatorCode
      );
      const imageAttachmentId = cleanOptionalInteger(itemInput?.imageAttachmentId ?? existingItem?.imageAttachmentId);
      if (imageAttachmentId !== null) await validateImageAttachmentForQuote(quoteId, quoteItem.id, imageAttachmentId);

      await client.query(
        `
        INSERT INTO public.quick_turn_quote_customer_export_items (
          export_id,
          quote_item_id,
          option_label,
          customer_description,
          customer_notes,
          factory_display,
          selected_breaks,
          selected_method_code,
          image_attachment_id,
          sort_order
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9::bigint, $10)
        ON CONFLICT (export_id, quote_item_id) DO UPDATE
        SET option_label = EXCLUDED.option_label,
            customer_description = EXCLUDED.customer_description,
            customer_notes = EXCLUDED.customer_notes,
            factory_display = EXCLUDED.factory_display,
            selected_breaks = EXCLUDED.selected_breaks,
            selected_method_code = EXCLUDED.selected_method_code,
            image_attachment_id = COALESCE(EXCLUDED.image_attachment_id, quick_turn_quote_customer_export_items.image_attachment_id),
            sort_order = EXCLUDED.sort_order,
            updated_at = now()
        `,
        [
          exportId,
          quoteItem.id,
          cleanText(itemInput?.optionLabel) ?? existingItem?.optionLabel ?? defaults.optionLabel,
          cleanText(itemInput?.customerDescription) ?? existingItem?.customerDescription ?? defaults.customerDescription,
          cleanText(itemInput?.customerNotes) ?? existingItem?.customerNotes,
          cleanText(itemInput?.factoryDisplay) ?? existingItem?.factoryDisplay ?? defaults.factoryDisplay,
          toJson(selectedBreaks.length ? selectedBreaks : fallbackBreaks),
          cleanText(itemInput?.selectedMethodCode ?? existingItem?.selectedMethodCode),
          imageAttachmentId,
          cleanSortOrder(itemInput?.sortOrder, defaults.sortOrder),
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const detail = await getQuickTurnCustomerExport(quoteId, { includeVoided: true });

  await db.query(
    `
    UPDATE public.quick_turn_quote_customer_exports
    SET export_snapshot = $2::jsonb
    WHERE quote_id = $1::uuid
    `,
    [quoteId, toJson(buildExportSnapshot(detail))]
  );

  await logCustomerExportActivity({
    entityId: quoteId,
    eventType: existing ? "customer_export_updated" : "customer_export_created",
    fieldName: "customer_export",
    message: existing
      ? `Customer-facing Quick Turn quote setup updated for ${quote.quoteNumber}.`
      : `Customer-facing Quick Turn quote setup created for ${quote.quoteNumber}.`,
    previousValue: existing
      ? {
          selectedCalculatorCode: existing.selectedCalculatorCode,
          quotePreparedForDisplay: existing.quotePreparedForDisplay,
          workflowSalesOrderNumber: existing.workflowSalesOrderNumber,
        }
      : null,
    newValue: buildExportSnapshot(detail),
    audit,
  });

  return detail;
}

async function ensureExportExists(quoteId: string, audit: QuickTurnCustomerExportAuditInput): Promise<string> {
  const existing = await getExportHeader(db, quoteId);
  if (existing) return existing.id;

  const quote = await getQuoteForExport(quoteId, true);
  const defaults = buildDefaultExport(quote);
  const changedBy = cleanText(audit.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(audit.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalInteger(audit.changedByEmployeeNumber);

  const result = await db.query<{ id: string }>(
    `
    INSERT INTO public.quick_turn_quote_customer_exports (
      quote_id,
      selected_calculator_id,
      selected_calculator_code,
      selected_calculator_name_snapshot,
      prepared_for_customer_id,
      prepared_for_customer_code_snapshot,
      prepared_for_customer_name_snapshot,
      quote_prepared_for_display,
      workflow_sales_order_number,
      program_logo_text,
      cap_program_name,
      sample_production_details,
      production_time_details,
      fob,
      additional_information,
      created_by,
      created_by_user_id,
      created_by_employee_number,
      updated_by,
      updated_by_user_id,
      updated_by_employee_number
    )
    VALUES ($1::uuid, $2::integer, $3, $4, $5::bigint, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::uuid, $18, $16, $17::uuid, $18)
    RETURNING id
    `,
    [
      quoteId,
      defaults.selectedCalculatorId,
      defaults.selectedCalculatorCode,
      defaults.selectedCalculatorName,
      cleanOptionalBigintId(defaults.preparedForCustomerId),
      defaults.preparedForCustomerCodeSnapshot,
      defaults.preparedForCustomerNameSnapshot,
      defaults.quotePreparedForDisplay,
      defaults.workflowSalesOrderNumber,
      defaults.programLogoText,
      defaults.capProgramName,
      defaults.sampleProductionDetails,
      defaults.productionTimeDetails,
      defaults.fob,
      defaults.additionalInformation,
      changedBy,
      changedByUserId,
      changedByEmployeeNumber,
    ]
  );

  return result.rows[0].id;
}

export async function setQuickTurnCustomerExportItemImage(
  quoteId: string,
  quoteItemId: string,
  attachmentId: number | string | null,
  audit: QuickTurnCustomerExportAuditInput
): Promise<QuickTurnCustomerExportDetail> {
  const quote = await getQuoteForExport(quoteId, true);
  if (quote.isVoided) throw new Error("Voided Quick Turn quotes cannot be edited.");

  const quoteItem = quote.items.find((item: any) => item.id === quoteItemId);
  if (!quoteItem) throw new Error("Quote item was not found.");

  const nextAttachmentId = cleanOptionalInteger(attachmentId);
  if (nextAttachmentId !== null) await validateImageAttachmentForQuote(quoteId, quoteItemId, nextAttachmentId);

  const exportId = await ensureExportExists(quoteId, audit);
  const base = buildDefaultItem(quote, quoteItem, quote.items.indexOf(quoteItem));
  const existingItemRows = await getExportItems(db, exportId);
  const existingItemsByQuoteItemId = mapExportRowsByQuoteItemId(existingItemRows);
  const existingItemsBySortOrder = mapExportRowsBySortOrder(existingItemRows);
  const exactExistingItem = existingItemsByQuoteItemId.get(quoteItemId) ?? null;
  const sortExistingItem = existingItemsBySortOrder.get(Number(base.sortOrder ?? 0)) ?? null;
  const existingItemCandidates = [exactExistingItem, sortExistingItem].filter(Boolean) as ExportItemRow[];
  const existingItem = existingItemCandidates.sort((a, b) => exportItemRowQuality(b) - exportItemRowQuality(a))[0] ?? null;

  await db.query(
    `
    INSERT INTO public.quick_turn_quote_customer_export_items (
      export_id,
      quote_item_id,
      option_label,
      customer_description,
      customer_notes,
      factory_display,
      selected_breaks,
      image_attachment_id,
      sort_order
    )
    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8::bigint, $9)
    ON CONFLICT (export_id, quote_item_id) DO UPDATE
    SET option_label = COALESCE(quick_turn_quote_customer_export_items.option_label, EXCLUDED.option_label),
        customer_description = COALESCE(quick_turn_quote_customer_export_items.customer_description, EXCLUDED.customer_description),
        customer_notes = COALESCE(quick_turn_quote_customer_export_items.customer_notes, EXCLUDED.customer_notes),
        factory_display = COALESCE(quick_turn_quote_customer_export_items.factory_display, EXCLUDED.factory_display),
        selected_breaks = CASE
          WHEN jsonb_array_length(quick_turn_quote_customer_export_items.selected_breaks) > 0 THEN quick_turn_quote_customer_export_items.selected_breaks
          ELSE EXCLUDED.selected_breaks
        END,
        image_attachment_id = EXCLUDED.image_attachment_id,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    `,
    [
      exportId,
      quoteItemId,
      existingItem?.optionLabel ?? base.optionLabel,
      existingItem?.customerDescription ?? base.customerDescription,
      existingItem?.customerNotes ?? null,
      existingItem?.factoryDisplay ?? base.factoryDisplay,
      toJson(parseBreaks(existingItem?.selectedBreaks)),
      nextAttachmentId,
      base.sortOrder,
    ]
  );

  await logCustomerExportActivity({
    entityId: quoteId,
    eventType: nextAttachmentId === null ? "customer_export_image_removed" : "customer_export_image_selected",
    fieldName: "image_attachment_id",
    message:
      nextAttachmentId === null
        ? `Customer-facing image removed for ${base.optionLabel}.`
        : `Customer-facing image selected for ${base.optionLabel}.`,
    previousValue: existingItem?.imageAttachmentId ?? null,
    newValue: nextAttachmentId,
    audit,
  });

  const detail = await getQuickTurnCustomerExport(quoteId, { includeVoided: true });
  await updateQuickTurnCustomerExportSnapshot(quoteId, detail);
  return detail;
}

async function updateQuickTurnCustomerExportSnapshot(
  quoteId: string,
  detail?: QuickTurnCustomerExportDetail
): Promise<void> {
  const header = await getExportHeader(db, quoteId);
  if (!header) return;

  const snapshotDetail = detail ?? (await getQuickTurnCustomerExport(quoteId, { includeVoided: true }));
  await db.query(
    `
    UPDATE public.quick_turn_quote_customer_exports
    SET export_snapshot = $2::jsonb,
        updated_at = now()
    WHERE quote_id = $1::uuid
    `,
    [quoteId, toJson(buildExportSnapshot(snapshotDetail))]
  );
}

export async function refreshQuickTurnCustomerExportSnapshot(quoteId: string): Promise<void> {
  await updateQuickTurnCustomerExportSnapshot(quoteId);
}

export async function logQuickTurnCustomerExportPreview(
  quoteId: string,
  audit: QuickTurnCustomerExportAuditInput
): Promise<void> {
  const quote = await getQuoteForExport(quoteId, true);
  await logCustomerExportActivity({
    entityId: quoteId,
    eventType: "customer_export_previewed",
    fieldName: "customer_export",
    message: `Customer-facing Quick Turn quote preview opened for ${quote.quoteNumber}.`,
    newValue: { quoteStatus: quote.quoteStatus, isVoided: quote.isVoided },
    audit,
  });
}
