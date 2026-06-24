// lib/repositories/itemPricingExportRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { calculateItemPricingPreview } from "@/lib/repositories/itemPricingRepo";
import { buildBasePricingCsv, buildExportFileName } from "@/lib/itemPricing/itemPricingExportService";
import {
  buildInternalBasePricingPdf,
  buildItemPricingDetailPdf,
  buildPdfExportFileName,
  buildPriceBookSummaryPdf,
} from "@/lib/itemPricing/itemPricingPdfExportService";
import type { ItemPricingCalculationResult, PagedResult, SortDir } from "@/lib/itemPricing/types";
import type {
  ItemPricingExportFilters,
  ItemPricingExportRun,
  ItemPricingExportRunListOptions,
  ItemPricingExportSourceRow,
  ItemPricingGenerateExportInput,
} from "@/lib/itemPricing/exportTypes";

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

type ExportableCalculation = ItemPricingCalculationResult & { fatalError?: string | null };

type ResolvedPriceBook = { id: string; code: string; name: string };

const EXPORT_ENTITY_TYPE = "item_pricing_export_run";
const MODULE_NAME = "Item Pricing Setup";
const PDF_EXPORT_TYPES = new Set(["BASE_PRICING_PDF", "ITEM_DETAIL_PDF", "PRICE_BOOK_SUMMARY_PDF"]);

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function cleanBool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function cleanLimit(value: unknown, fallback = 50, max = 250): number {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function cleanOffset(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

function cleanSortDir(value: unknown): SortDir {
  return String(value || "desc").toLowerCase() === "asc" ? "asc" : "desc";
}

function cleanPositiveInt(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${label} must be a valid lookup value.`);
  return n;
}

function userName(input: { changedBy?: string | null }) {
  return cleanText(input.changedBy) || "Unknown User";
}

function changedByUserId(input: { changedByUserId?: string | null }) {
  return cleanText(input.changedByUserId);
}

function changedByEmployeeNumber(input: { changedByEmployeeNumber?: number | string | null }) {
  const raw = input.changedByEmployeeNumber;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function pageResult<T>(rows: T[], total: number, limit: number, offset: number): PagedResult<T> {
  return { rows, total, pageSize: limit, offset };
}

function exportTypeLabel(exportType: string) {
  const labels: Record<string, string> = {
    BASE_PRICING_CSV: "Base pricing CSV",
    BASE_PRICING_PDF: "Internal base pricing PDF",
    ITEM_DETAIL_PDF: "Item detail PDF",
    PRICE_BOOK_SUMMARY_PDF: "Price book summary PDF",
  };
  return labels[exportType] || exportType;
}

async function logExportActivity(input: {
  entityId: string;
  eventType: string;
  message: string;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  await createActivityHistory({
    entityType: EXPORT_ENTITY_TYPE,
    entityId: input.entityId,
    eventType: input.eventType,
    fieldName: null,
    previousValue: input.previousValue,
    newValue: input.newValue,
    message: input.message,
    module: MODULE_NAME,
    userId: changedByUserId(input),
    userName: userName(input),
    employeeNumber: changedByEmployeeNumber(input),
  });
}

async function resolvePriceBook(queryable: Queryable, id?: string | null): Promise<ResolvedPriceBook> {
  const clean = cleanText(id);
  if (clean) {
    const { rows } = await queryable.query<ResolvedPriceBook>(
      `SELECT id, code, name FROM public.item_pricing_price_books WHERE id = $1 AND is_voided = false LIMIT 1`,
      [clean]
    );
    if (!rows[0]) throw new Error("Invalid price book.");
    return rows[0];
  }

  const { rows } = await queryable.query<ResolvedPriceBook>(
    `
    SELECT id, code, name
    FROM public.item_pricing_price_books
    WHERE is_voided = false
    ORDER BY is_default DESC, effective_date DESC NULLS LAST, created_at DESC
    LIMIT 1
    `
  );

  if (!rows[0]) throw new Error("No item pricing price book exists.");
  return rows[0];
}

async function resolveRuleSetId(queryable: Queryable, filters: ItemPricingExportFilters): Promise<number | null> {
  const ruleSetId = cleanPositiveInt(filters.ruleSetId, "Rule Set");
  if (ruleSetId) return ruleSetId;

  const code = cleanText(filters.ruleSetCode);
  if (!code) return null;

  const { rows } = await queryable.query<{ id: number }>(
    `SELECT id FROM public.item_pricing_rule_sets WHERE upper(code) = upper($1) LIMIT 1`,
    [code]
  );

  if (!rows[0]) throw new Error("Invalid rule set filter.");
  return rows[0].id;
}

function normalizeFilters(filters: ItemPricingExportFilters | null | undefined, exportType = "BASE_PRICING_CSV"): ItemPricingExportFilters {
  const isPdf = PDF_EXPORT_TYPES.has(String(exportType || "").toUpperCase());
  const isItemDetail = String(exportType || "").toUpperCase() === "ITEM_DETAIL_PDF";

  return {
    q: cleanText(filters?.q),
    ruleSetId: filters?.ruleSetId ?? null,
    ruleSetCode: cleanText(filters?.ruleSetCode),
    itemId: cleanText(filters?.itemId),
    itemCodeStartsWith: cleanText(filters?.itemCodeStartsWith),
    includeInactive: cleanBool(filters?.includeInactive, false),
    onlyWithBasePrice: filters?.onlyWithBasePrice === undefined ? true : cleanBool(filters?.onlyWithBasePrice, true),
    maxRows: isItemDetail ? 1 : cleanLimit(filters?.maxRows, isPdf ? 250 : 5000, isPdf ? 1000 : 20000),
  };
}

async function listExportSourceItems(priceBookId: string, filters: ItemPricingExportFilters): Promise<ItemPricingExportSourceRow[]> {
  const params: any[] = [priceBookId];
  const where: string[] = ["i.is_voided = false"];
  const onlyWithBasePrice = cleanBool(filters.onlyWithBasePrice, true);

  if (!cleanBool(filters.includeInactive, false)) where.push("i.active = true");

  const itemId = cleanText(filters.itemId);
  if (itemId) {
    params.push(itemId);
    where.push(`i.id = $${params.length}`);
  }

  const ruleSetId = await resolveRuleSetId(db, filters);
  if (ruleSetId) {
    params.push(ruleSetId);
    where.push(`i.rule_set_id = $${params.length}`);
  }

  const startsWith = cleanText(filters.itemCodeStartsWith);
  if (startsWith) {
    params.push(`${startsWith}%`);
    where.push(`i.item_code ILIKE $${params.length}`);
  }

  const q = cleanText(filters.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(i.item_code ILIKE $${params.length} OR COALESCE(i.item_description, '') ILIKE $${params.length} OR rs.name ILIKE $${params.length})`);
  }

  const limit = cleanLimit(filters.maxRows, 5000, 20000);
  params.push(limit);

  const baseJoin = onlyWithBasePrice
    ? `JOIN public.item_pricing_item_base_prices bp ON bp.item_id = i.id AND bp.price_book_id = $1`
    : `LEFT JOIN public.item_pricing_item_base_prices bp ON bp.item_id = i.id AND bp.price_book_id = $1`;

  const { rows } = await db.query<ItemPricingExportSourceRow>(
    `
    SELECT
      i.id AS "itemId",
      i.item_code AS "itemCode",
      i.item_description AS "itemDescription",
      i.rule_set_id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      rs.name AS "ruleSetName",
      i.active,
      bp.blank_eqp_price::float8 AS "blankEqpPrice"
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    ${baseJoin}
    WHERE ${where.join(" AND ")}
    ORDER BY i.item_code ASC
    LIMIT $${params.length}
    `,
    params
  );

  return rows;
}

const EXPORT_SORT_COLUMNS: Record<string, string> = {
  createdAt: "er.created_at",
  fileName: "er.file_name",
  exportType: "er.export_type",
  fileFormat: "er.file_format",
  rowCount: "er.row_count",
  status: "er.status",
  priceBook: "pb.code",
};

function exportSelectSql(includeContent = false) {
  return `
    SELECT
      er.id,
      er.price_book_id AS "priceBookId",
      pb.code AS "priceBookCode",
      pb.name AS "priceBookName",
      er.export_type AS "exportType",
      er.file_name AS "fileName",
      er.file_format AS "fileFormat",
      er.filters_json AS "filtersJson",
      er.row_count AS "rowCount",
      er.status,
      ${includeContent ? `er.csv_content AS "csvContent", er.pdf_content_base64 AS "pdfContentBase64",` : ""}
      er.content_mime_type AS "contentMimeType",
      er.content_size_bytes AS "contentSizeBytes",
      er.error_message AS "errorMessage",
      er.created_at AS "createdAt",
      er.created_by AS "createdBy"
    FROM public.item_pricing_export_runs er
    JOIN public.item_pricing_price_books pb ON pb.id = er.price_book_id
  `;
}

export async function listItemPricingExportRuns(
  options: ItemPricingExportRunListOptions = {}
): Promise<PagedResult<ItemPricingExportRun>> {
  const params: any[] = [];
  const where: string[] = [];
  const limit = cleanLimit(options.limit, 25, 250);
  const offset = cleanOffset(options.offset);

  const priceBookId = cleanText(options.priceBookId);
  if (priceBookId) {
    params.push(priceBookId);
    where.push(`er.price_book_id = $${params.length}`);
  }

  const exportType = cleanText(options.exportType);
  if (exportType) {
    params.push(exportType.toUpperCase());
    where.push(`er.export_type = $${params.length}`);
  }

  const fileFormat = cleanText(options.fileFormat);
  if (fileFormat) {
    params.push(fileFormat.toUpperCase());
    where.push(`er.file_format = $${params.length}`);
  }

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(er.file_name ILIKE $${params.length} OR pb.code ILIKE $${params.length} OR COALESCE(er.created_by, '') ILIKE $${params.length})`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM public.item_pricing_export_runs er
    JOIN public.item_pricing_price_books pb ON pb.id = er.price_book_id
    ${sqlWhere}
    `,
    params
  );

  const sortColumn = EXPORT_SORT_COLUMNS[String(options.sortBy || "createdAt")] || "er.created_at";
  const sortDir = cleanSortDir(options.sortDir);
  params.push(limit, offset);

  const { rows } = await db.query<ItemPricingExportRun>(
    `
    ${exportSelectSql(false)}
    ${sqlWhere}
    ORDER BY ${sortColumn} ${sortDir}, er.created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
    `,
    params
  );

  return pageResult(rows, Number(count.rows[0]?.count || 0), limit, offset);
}

export async function getItemPricingExportRun(id: string, includeContent = false): Promise<ItemPricingExportRun | null> {
  const cleanId = cleanText(id);
  if (!cleanId) throw new Error("Export run is required.");

  const { rows } = await db.query<ItemPricingExportRun>(
    `${exportSelectSql(includeContent)} WHERE er.id = $1 LIMIT 1`,
    [cleanId]
  );

  return rows[0] ?? null;
}

async function collectCalculationResults(priceBook: ResolvedPriceBook, filters: ItemPricingExportFilters): Promise<ExportableCalculation[]> {
  const sourceRows = await listExportSourceItems(priceBook.id, filters);
  const results: ExportableCalculation[] = [];

  for (const source of sourceRows) {
    try {
      const result = await calculateItemPricingPreview({
        priceBookId: priceBook.id,
        itemId: source.itemId,
      });
      results.push(result);
    } catch (err: any) {
      results.push({
        priceBook: { id: priceBook.id, code: priceBook.code },
        item: {
          id: source.itemId,
          itemCode: source.itemCode,
          itemDescription: source.itemDescription,
          active: source.active,
        },
        ruleSet: {
          id: source.ruleSetId,
          code: source.ruleSetCode,
          name: source.ruleSetName,
          active: true,
        },
        blankEqpPrice: source.blankEqpPrice,
        flatEqpPrice: null,
        threeDEqpPrice: null,
        methods: [],
        warnings: [],
        errors: [],
        fatalError: err?.message || "Failed to calculate item pricing.",
      });
    }
  }

  return results;
}

function contentSizeFromBase64(base64: string | null | undefined) {
  if (!base64) return 0;
  return Buffer.from(base64, "base64").byteLength;
}

async function insertExportRun(input: {
  priceBook: ResolvedPriceBook;
  exportType: string;
  fileName: string;
  fileFormat: "CSV" | "PDF";
  filters: ItemPricingExportFilters;
  rowCount: number;
  csvContent?: string | null;
  pdfContentBase64?: string | null;
  errorMessage?: string | null;
  changedBy: string;
}) {
  const mimeType = input.fileFormat === "PDF" ? "application/pdf" : "text/csv; charset=utf-8";
  const sizeBytes = input.fileFormat === "PDF"
    ? contentSizeFromBase64(input.pdfContentBase64)
    : Buffer.byteLength(input.csvContent || "", "utf8");

  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.item_pricing_export_runs (
      price_book_id,
      export_type,
      file_name,
      file_format,
      filters_json,
      row_count,
      status,
      csv_content,
      pdf_content_base64,
      content_mime_type,
      content_size_bytes,
      error_message,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'COMPLETED', $7, $8, $9, $10, $11, $12)
    RETURNING id
    `,
    [
      input.priceBook.id,
      input.exportType,
      input.fileName,
      input.fileFormat,
      JSON.stringify(input.filters),
      input.rowCount,
      input.csvContent ?? null,
      input.pdfContentBase64 ?? null,
      mimeType,
      sizeBytes,
      input.errorMessage ?? null,
      input.changedBy,
    ]
  );

  const created = await getItemPricingExportRun(rows[0].id, true);
  if (!created) throw new Error("Failed to reload export run.");
  return created;
}

export async function generateItemPricingExport(input: ItemPricingGenerateExportInput): Promise<ItemPricingExportRun> {
  const exportType = String(input.exportType || "BASE_PRICING_CSV").trim().toUpperCase();
  const allowed = new Set(["BASE_PRICING_CSV", "BASE_PRICING_PDF", "ITEM_DETAIL_PDF", "PRICE_BOOK_SUMMARY_PDF"]);
  if (!allowed.has(exportType)) throw new Error("Unsupported item pricing export type.");

  const priceBook = await resolvePriceBook(db, input.priceBookId ?? null);
  const filters = normalizeFilters(input.filters, exportType);

  if (exportType === "ITEM_DETAIL_PDF" && !cleanText(filters.itemId)) {
    throw new Error("Choose an item before generating an Item Detail PDF.");
  }

  const results = await collectCalculationResults(priceBook, filters);
  const errorCount = results.filter((result) => (result.errors || []).length > 0 || result.fatalError).length;
  const changedBy = userName(input);

  let created: ItemPricingExportRun;

  if (exportType === "BASE_PRICING_CSV") {
    const csvContent = buildBasePricingCsv(results);
    created = await insertExportRun({
      priceBook,
      exportType,
      fileName: buildExportFileName({ priceBookCode: priceBook.code }),
      fileFormat: "CSV",
      filters,
      rowCount: results.length,
      csvContent,
      errorMessage: errorCount > 0 ? `${errorCount} row(s) contained calculation errors. See CSV errors column.` : null,
      changedBy,
    });
  } else {
    let pdfBytes: Uint8Array;
    if (exportType === "ITEM_DETAIL_PDF") {
      pdfBytes = await buildItemPricingDetailPdf({ priceBook, results, filters, generatedBy: changedBy });
    } else if (exportType === "PRICE_BOOK_SUMMARY_PDF") {
      pdfBytes = await buildPriceBookSummaryPdf({ priceBook, results, filters, generatedBy: changedBy });
    } else {
      pdfBytes = await buildInternalBasePricingPdf({ priceBook, results, filters, generatedBy: changedBy });
    }

    const itemCode = exportType === "ITEM_DETAIL_PDF" ? results[0]?.item.itemCode : null;
    created = await insertExportRun({
      priceBook,
      exportType,
      fileName: buildPdfExportFileName({ priceBookCode: priceBook.code, exportType, itemCode }),
      fileFormat: "PDF",
      filters,
      rowCount: results.length,
      pdfContentBase64: Buffer.from(pdfBytes).toString("base64"),
      errorMessage: errorCount > 0 ? `${errorCount} item(s) contained calculation errors. See PDF notes.` : null,
      changedBy,
    });
  }

  await logExportActivity({
    entityId: created.id,
    eventType: "export_created",
    message: `${exportTypeLabel(exportType)} created for ${priceBook.code} with ${created.rowCount} row(s).`,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    newValue: {
      id: created.id,
      priceBookCode: created.priceBookCode,
      exportType: created.exportType,
      fileName: created.fileName,
      fileFormat: created.fileFormat,
      rowCount: created.rowCount,
      filters,
    },
  });

  return created;
}

export async function generateBasePricingCsvExport(input: ItemPricingGenerateExportInput): Promise<ItemPricingExportRun> {
  return generateItemPricingExport({ ...input, exportType: "BASE_PRICING_CSV" });
}
