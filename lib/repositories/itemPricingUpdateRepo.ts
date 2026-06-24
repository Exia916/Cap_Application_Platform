// lib/repositories/itemPricingUpdateRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { calculateItemPricingPreview, saveItemPricingCalculatedSnapshot } from "@/lib/repositories/itemPricingRepo";
import { FLAT_EMB_ADDER, THREE_D_EMB_ADDER } from "@/lib/itemPricing/constants";
import { parseItemPricingUpdateCsv } from "@/lib/itemPricing/itemPricingUpdateBatchService";
import {
  ITEM_PRICING_UPDATE_ADJUSTMENT_TYPES,
  ITEM_PRICING_UPDATE_TYPES,
  type ItemPricingApplyUpdateBatchInput,
  type ItemPricingCreateUpdateBatchInput,
  type ItemPricingUpdateAdjustmentType,
  type ItemPricingUpdateBatch,
  type ItemPricingUpdateBatchDetail,
  type ItemPricingUpdateBatchListOptions,
  type ItemPricingUpdateBatchPagedResult,
  type ItemPricingUpdateCriteria,
  type ItemPricingUpdateInputRow,
  type ItemPricingUpdateType,
} from "@/lib/itemPricing/updateTypes";
import type { PagedResult, SortDir } from "@/lib/itemPricing/types";

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

type PreviewRow = {
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
};

type SourceItemRow = {
  itemId: string;
  itemCode: string;
  itemDescription: string | null;
  ruleSetId: number;
  ruleSetCode: string;
  active: boolean;
  allowsFlatEmb: boolean;
  allows3dEmb: boolean;
  oldBlankEqp: number | null;
};

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function cleanRequiredText(value: unknown, label: string): string {
  const s = cleanText(value);
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

function cleanBool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function cleanLimit(value: unknown): number {
  const n = Number(value ?? 25);
  if (!Number.isInteger(n) || n <= 0) return 25;
  return Math.min(n, 250);
}

function cleanOffset(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

function cleanSortDir(value: unknown): SortDir {
  return String(value || "desc").toLowerCase() === "asc" ? "asc" : "desc";
}

function cleanMoneyNullable(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number.`);
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

function cleanNumberNullable(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a valid number.`);
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

function money2(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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

function cleanUpdateType(value: unknown): ItemPricingUpdateType {
  const s = String(value || "").trim().toUpperCase() as ItemPricingUpdateType;
  if (!(ITEM_PRICING_UPDATE_TYPES as readonly string[]).includes(s)) throw new Error("Invalid update type.");
  return s;
}

function cleanAdjustmentType(value: unknown): ItemPricingUpdateAdjustmentType {
  const s = String(value || "").trim().toUpperCase() as ItemPricingUpdateAdjustmentType;
  if (!(ITEM_PRICING_UPDATE_ADJUSTMENT_TYPES as readonly string[]).includes(s)) throw new Error("Invalid adjustment type.");
  return s;
}

function normalizeCriteria(criteria: ItemPricingUpdateCriteria | null | undefined): ItemPricingUpdateCriteria {
  return {
    ruleSetId: criteria?.ruleSetId ?? null,
    ruleSetCode: cleanText(criteria?.ruleSetCode),
    includeInactive: criteria?.includeInactive ?? false,
    itemCodeStartsWith: cleanText(criteria?.itemCodeStartsWith),
  };
}

async function logUpdateActivity(input: {
  entityType: string;
  entityId: string;
  eventType: string;
  message: string;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
  previousValue?: unknown;
  newValue?: unknown;
  fieldName?: string | null;
}) {
  await createActivityHistory({
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    fieldName: input.fieldName ?? null,
    previousValue: input.previousValue,
    newValue: input.newValue,
    message: input.message,
    module: "Item Pricing Setup",
    userId: changedByUserId(input),
    userName: userName(input),
    employeeNumber: changedByEmployeeNumber(input),
  });
}

async function resolvePriceBookId(queryable: Queryable, id?: string | null): Promise<string> {
  const clean = cleanText(id);
  if (clean) {
    const { rows } = await queryable.query<{ id: string }>(
      `SELECT id FROM public.item_pricing_price_books WHERE id = $1 AND is_voided = false LIMIT 1`,
      [clean]
    );
    if (!rows[0]) throw new Error("Invalid price book.");
    return rows[0].id;
  }

  const { rows } = await queryable.query<{ id: string }>(
    `
    SELECT id
    FROM public.item_pricing_price_books
    WHERE is_voided = false
    ORDER BY is_default DESC, effective_date DESC NULLS LAST, created_at DESC
    LIMIT 1
    `
  );

  if (!rows[0]) throw new Error("No item pricing price book exists.");
  return rows[0].id;
}

async function resolveRuleSetId(queryable: Queryable, criteria: ItemPricingUpdateCriteria): Promise<number | null> {
  if (criteria.ruleSetId !== null && criteria.ruleSetId !== undefined && criteria.ruleSetId !== "") {
    const n = Number(criteria.ruleSetId);
    if (!Number.isInteger(n) || n <= 0) throw new Error("Rule set filter must be a valid rule set.");
    return n;
  }

  const code = cleanText(criteria.ruleSetCode);
  if (!code) return null;

  const { rows } = await queryable.query<{ id: number }>(
    `SELECT id FROM public.item_pricing_rule_sets WHERE upper(code) = upper($1) LIMIT 1`,
    [code]
  );

  if (!rows[0]) throw new Error("Rule set filter was not found.");
  return rows[0].id;
}

const batchSelectSql = `
  SELECT
    b.id,
    b.batch_number AS "batchNumber",
    b.price_book_id AS "priceBookId",
    pb.code AS "priceBookCode",
    pb.name AS "priceBookName",
    b.name,
    b.update_type AS "updateType",
    b.adjustment_type AS "adjustmentType",
    b.adjustment_value::float AS "adjustmentValue",
    b.criteria_json AS "criteriaJson",
    b.status,
    b.notes,
    b.row_count AS "rowCount",
    b.valid_row_count AS "validRowCount",
    b.warning_row_count AS "warningRowCount",
    b.error_row_count AS "errorRowCount",
    b.applied_row_count AS "appliedRowCount",
    b.skipped_row_count AS "skippedRowCount",
    b.snapshot_error_count AS "snapshotErrorCount",
    b.created_at AS "createdAt",
    b.created_by AS "createdBy",
    b.validated_at AS "validatedAt",
    b.validated_by AS "validatedBy",
    b.applied_at AS "appliedAt",
    b.applied_by AS "appliedBy",
    b.is_voided AS "isVoided",
    b.voided_at AS "voidedAt",
    b.voided_by AS "voidedBy",
    b.void_reason AS "voidReason"
  FROM public.item_pricing_update_batches b
  JOIN public.item_pricing_price_books pb ON pb.id = b.price_book_id
`;

const rowSelectSql = `
  SELECT
    r.id,
    r.batch_id AS "batchId",
    r.row_number AS "rowNumber",
    r.item_id AS "itemId",
    r.item_code AS "itemCode",
    r.item_description AS "itemDescription",
    r.rule_set_id AS "ruleSetId",
    r.rule_set_code AS "ruleSetCode",
    r.old_blank_eqp::float AS "oldBlankEqp",
    r.new_blank_eqp::float AS "newBlankEqp",
    r.change_amount::float AS "changeAmount",
    r.change_percent::float AS "changePercent",
    r.old_flat_eqp::float AS "oldFlatEqp",
    r.new_flat_eqp::float AS "newFlatEqp",
    r.old_3d_eqp::float AS "old3dEqp",
    r.new_3d_eqp::float AS "new3dEqp",
    r.status,
    r.warning_message AS "warningMessage",
    r.error_message AS "errorMessage",
    r.created_at AS "createdAt",
    r.applied_at AS "appliedAt"
  FROM public.item_pricing_update_batch_rows r
`;

export async function listItemPricingUpdateBatches(
  options: ItemPricingUpdateBatchListOptions = {}
): Promise<ItemPricingUpdateBatchPagedResult> {
  const limit = cleanLimit(options.limit);
  const offset = cleanOffset(options.offset);
  const sortDir = cleanSortDir(options.sortDir);
  const params: any[] = [];
  const where = ["b.is_voided = false"];

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(b.batch_number ILIKE $${params.length} OR b.name ILIKE $${params.length} OR pb.code ILIKE $${params.length})`);
  }

  const priceBookId = cleanText(options.priceBookId);
  if (priceBookId) {
    params.push(priceBookId);
    where.push(`b.price_book_id = $${params.length}`);
  }

  const status = cleanText(options.status);
  if (status) {
    params.push(status.toUpperCase());
    where.push(`b.status = $${params.length}`);
  }

  const sortable: Record<string, string> = {
    createdAt: "b.created_at",
    batchNumber: "b.batch_number",
    name: "b.name",
    status: "b.status",
    rowCount: "b.row_count",
    appliedAt: "b.applied_at",
  };
  const sortBy = sortable[String(options.sortBy || "createdAt")] || sortable.createdAt;
  const sqlWhere = `WHERE ${where.join(" AND ")}`;

  const count = await db.query<{ count: string }>(
    `
    SELECT count(*)::text AS count
    FROM public.item_pricing_update_batches b
    JOIN public.item_pricing_price_books pb ON pb.id = b.price_book_id
    ${sqlWhere}
    `,
    params
  );

  const queryParams = [...params, limit, offset];
  const { rows } = await db.query<ItemPricingUpdateBatch>(
    `
    ${batchSelectSql}
    ${sqlWhere}
    ORDER BY ${sortBy} ${sortDir}, b.batch_number DESC
    LIMIT $${queryParams.length - 1}
    OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return pageResult(rows, Number(count.rows[0]?.count || 0), limit, offset);
}

export async function getItemPricingUpdateBatch(id: string): Promise<ItemPricingUpdateBatchDetail | null> {
  const clean = cleanRequiredText(id, "Update Batch");
  const batch = await db.query<ItemPricingUpdateBatch>(
    `${batchSelectSql} WHERE b.id = $1 LIMIT 1`,
    [clean]
  );
  const row = batch.rows[0];
  if (!row) return null;

  const rows = await db.query<any>(
    `${rowSelectSql} WHERE r.batch_id = $1 ORDER BY r.row_number ASC`,
    [clean]
  );

  return { ...row, rows: rows.rows };
}

async function findSourceItem(queryable: Queryable, input: { priceBookId: string; itemId?: string | null; itemCode?: string | null }): Promise<SourceItemRow | null> {
  const itemId = cleanText(input.itemId);
  const itemCode = cleanText(input.itemCode);
  if (!itemId && !itemCode) return null;

  const params: any[] = [input.priceBookId];
  const where = itemId ? "i.id = $2" : "upper(i.item_code) = upper($2)";
  params.push(itemId || itemCode);

  const { rows } = await queryable.query<SourceItemRow>(
    `
    SELECT
      i.id AS "itemId",
      i.item_code AS "itemCode",
      i.item_description AS "itemDescription",
      i.rule_set_id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      i.active,
      COALESCE(i.allows_flat_emb_override, rs.allows_flat_emb) AS "allowsFlatEmb",
      COALESCE(i.allows_3d_emb_override, rs.allows_3d_emb) AS "allows3dEmb",
      bp.blank_eqp_price::float AS "oldBlankEqp"
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    LEFT JOIN public.item_pricing_item_base_prices bp ON bp.item_id = i.id AND bp.price_book_id = $1
    WHERE ${where}
      AND i.is_voided = false
    LIMIT 1
    `,
    params
  );

  return rows[0] ?? null;
}

async function loadFilteredSourceItems(
  queryable: Queryable,
  input: { priceBookId: string; criteria: ItemPricingUpdateCriteria }
): Promise<SourceItemRow[]> {
  const criteria = normalizeCriteria(input.criteria);
  const params: any[] = [input.priceBookId];
  const where = ["i.is_voided = false", "bp.blank_eqp_price IS NOT NULL"];

  const includeInactive = cleanBool(criteria.includeInactive, false);
  if (!includeInactive) where.push("i.active = true");

  const ruleSetId = await resolveRuleSetId(queryable, criteria);
  if (ruleSetId) {
    params.push(ruleSetId);
    where.push(`i.rule_set_id = $${params.length}`);
  }

  const startsWith = cleanText(criteria.itemCodeStartsWith);
  if (startsWith) {
    params.push(`${startsWith}%`);
    where.push(`i.item_code ILIKE $${params.length}`);
  }

  const { rows } = await queryable.query<SourceItemRow>(
    `
    SELECT
      i.id AS "itemId",
      i.item_code AS "itemCode",
      i.item_description AS "itemDescription",
      i.rule_set_id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      i.active,
      COALESCE(i.allows_flat_emb_override, rs.allows_flat_emb) AS "allowsFlatEmb",
      COALESCE(i.allows_3d_emb_override, rs.allows_3d_emb) AS "allows3dEmb",
      bp.blank_eqp_price::float AS "oldBlankEqp"
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    JOIN public.item_pricing_item_base_prices bp ON bp.item_id = i.id AND bp.price_book_id = $1
    WHERE ${where.join(" AND ")}
    ORDER BY i.item_code ASC
    `,
    params
  );

  return rows;
}

function calculateNewBlankEqp(input: {
  oldBlankEqp: number | null;
  explicitNewBlankEqp?: number | null;
  adjustmentType: ItemPricingUpdateAdjustmentType;
  adjustmentValue: number | null;
}): number | null {
  if (input.adjustmentType === "SET_PRICE") return input.explicitNewBlankEqp ?? null;
  if (input.oldBlankEqp === null || input.oldBlankEqp === undefined) return null;
  if (input.adjustmentValue === null || input.adjustmentValue === undefined) return null;

  if (input.adjustmentType === "ADD_AMOUNT") {
    return Math.round((input.oldBlankEqp + input.adjustmentValue + Number.EPSILON) * 10000) / 10000;
  }

  if (input.adjustmentType === "PERCENT_CHANGE") {
    return Math.round((input.oldBlankEqp * (1 + input.adjustmentValue / 100) + Number.EPSILON) * 10000) / 10000;
  }

  return null;
}

function buildPreviewRow(input: {
  source: SourceItemRow | null;
  rowNumber: number;
  itemCode?: string | null;
  explicitNewBlankEqp?: number | null;
  adjustmentType: ItemPricingUpdateAdjustmentType;
  adjustmentValue: number | null;
}): PreviewRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.source) {
    errors.push(`Item ${input.itemCode || input.rowNumber} was not found or is voided.`);
  }

  const oldBlank = input.source?.oldBlankEqp ?? null;
  if (input.source && (oldBlank === null || oldBlank === undefined)) {
    errors.push(`${input.source.itemCode} does not have a stored Blank EQP price in this price book.`);
  }

  if (input.source?.active === false) {
    warnings.push(`${input.source.itemCode} is inactive.`);
  }

  const newBlank = calculateNewBlankEqp({
    oldBlankEqp: oldBlank,
    explicitNewBlankEqp: input.explicitNewBlankEqp ?? null,
    adjustmentType: input.adjustmentType,
    adjustmentValue: input.adjustmentValue,
  });

  if (newBlank === null || newBlank === undefined || !Number.isFinite(Number(newBlank))) {
    errors.push("New Blank EQP could not be calculated.");
  } else if (newBlank < 0) {
    errors.push("New Blank EQP cannot be negative.");
  }

  const oldFlat = oldBlank == null ? null : money2(oldBlank + FLAT_EMB_ADDER);
  const newFlat = newBlank == null ? null : money2(newBlank + FLAT_EMB_ADDER);
  const old3d = oldBlank == null || !input.source?.allows3dEmb ? null : money2(oldBlank + THREE_D_EMB_ADDER);
  const new3d = newBlank == null || !input.source?.allows3dEmb ? null : money2(newBlank + THREE_D_EMB_ADDER);
  const changeAmount = oldBlank == null || newBlank == null ? null : Math.round((newBlank - oldBlank + Number.EPSILON) * 10000) / 10000;
  const changePercent = oldBlank == null || oldBlank === 0 || newBlank == null ? null : Math.round((((newBlank - oldBlank) / oldBlank) * 100 + Number.EPSILON) * 10000) / 10000;

  return {
    rowNumber: input.rowNumber,
    itemId: input.source?.itemId ?? null,
    itemCode: input.source?.itemCode ?? cleanText(input.itemCode),
    itemDescription: input.source?.itemDescription ?? null,
    ruleSetId: input.source?.ruleSetId ?? null,
    ruleSetCode: input.source?.ruleSetCode ?? null,
    oldBlankEqp: oldBlank,
    newBlankEqp: newBlank,
    changeAmount,
    changePercent,
    oldFlatEqp: oldFlat,
    newFlatEqp: newFlat,
    old3dEqp: old3d,
    new3dEqp: new3d,
    status: errors.length ? "ERROR" : warnings.length ? "WARNING" : "VALID",
    warningMessage: warnings.join(" ") || null,
    errorMessage: errors.join(" ") || null,
  };
}

async function buildUpdateRows(
  queryable: Queryable,
  input: {
    priceBookId: string;
    updateType: ItemPricingUpdateType;
    adjustmentType: ItemPricingUpdateAdjustmentType;
    adjustmentValue: number | null;
    criteria: ItemPricingUpdateCriteria;
    rows: ItemPricingUpdateInputRow[];
  }
): Promise<PreviewRow[]> {
  if (input.updateType === "WHOLE_PRICE_BOOK" || input.updateType === "FILTERED_ITEMS") {
    if (input.adjustmentType === "SET_PRICE") {
      throw new Error("Filtered or whole price book batches must use Add Amount or Percent Change.");
    }
    if (input.adjustmentValue === null) throw new Error("Adjustment value is required.");

    const sources = await loadFilteredSourceItems(queryable, {
      priceBookId: input.priceBookId,
      criteria: input.updateType === "WHOLE_PRICE_BOOK" ? { includeInactive: false } : input.criteria,
    });

    if (sources.length === 0) throw new Error("No matching items with Blank EQP prices were found for this update batch.");

    return sources.map((source, index) =>
      buildPreviewRow({
        source,
        rowNumber: index + 1,
        adjustmentType: input.adjustmentType,
        adjustmentValue: input.adjustmentValue,
      })
    );
  }

  if (input.rows.length === 0) throw new Error("At least one item row is required.");

  const output: PreviewRow[] = [];
  const seen = new Set<string>();

  for (const [index, row] of input.rows.entries()) {
    const itemCode = cleanText(row.itemCode);
    const itemId = cleanText(row.itemId);
    const dedupeKey = (itemId || itemCode || `row-${index + 1}`).toUpperCase();
    const explicitNewBlank = cleanMoneyNullable(row.newBlankEqp ?? row.newBlankEqpPrice ?? row.blankEqpPrice, "New Blank EQP");

    if (seen.has(dedupeKey)) {
      output.push({
        rowNumber: index + 1,
        itemId: null,
        itemCode,
        itemDescription: null,
        ruleSetId: null,
        ruleSetCode: null,
        oldBlankEqp: null,
        newBlankEqp: explicitNewBlank,
        changeAmount: null,
        changePercent: null,
        oldFlatEqp: null,
        newFlatEqp: explicitNewBlank == null ? null : money2(explicitNewBlank + FLAT_EMB_ADDER),
        old3dEqp: null,
        new3dEqp: null,
        status: "ERROR",
        warningMessage: null,
        errorMessage: "Duplicate item in this batch.",
      });
      continue;
    }

    seen.add(dedupeKey);
    const source = await findSourceItem(queryable, { priceBookId: input.priceBookId, itemId, itemCode });
    output.push(
      buildPreviewRow({
        source,
        rowNumber: index + 1,
        itemCode,
        explicitNewBlankEqp: explicitNewBlank,
        adjustmentType: "SET_PRICE",
        adjustmentValue: null,
      })
    );
  }

  return output;
}

async function insertUpdateRows(queryable: Queryable, batchId: string, rows: PreviewRow[]) {
  for (const row of rows) {
    await queryable.query(
      `
      INSERT INTO public.item_pricing_update_batch_rows (
        batch_id, row_number, item_id, item_code, item_description, rule_set_id, rule_set_code,
        old_blank_eqp, new_blank_eqp, change_amount, change_percent,
        old_flat_eqp, new_flat_eqp, old_3d_eqp, new_3d_eqp,
        status, warning_message, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `,
      [
        batchId,
        row.rowNumber,
        row.itemId,
        row.itemCode,
        row.itemDescription,
        row.ruleSetId,
        row.ruleSetCode,
        row.oldBlankEqp,
        row.newBlankEqp,
        row.changeAmount,
        row.changePercent,
        row.oldFlatEqp,
        row.newFlatEqp,
        row.old3dEqp,
        row.new3dEqp,
        row.status,
        row.warningMessage,
        row.errorMessage,
      ]
    );
  }
}

async function recalcBatchCounts(queryable: Queryable, batchId: string, changedBy: string) {
  await queryable.query(
    `
    UPDATE public.item_pricing_update_batches b
    SET row_count = counts.row_count,
        valid_row_count = counts.valid_count,
        warning_row_count = counts.warning_count,
        error_row_count = counts.error_count,
        status = CASE WHEN counts.error_count > 0 THEN 'DRAFT' ELSE 'VALIDATED' END,
        validated_at = now(),
        validated_by = $2
    FROM (
      SELECT
        count(*)::int AS row_count,
        count(*) FILTER (WHERE status = 'VALID')::int AS valid_count,
        count(*) FILTER (WHERE status = 'WARNING')::int AS warning_count,
        count(*) FILTER (WHERE status = 'ERROR')::int AS error_count
      FROM public.item_pricing_update_batch_rows
      WHERE batch_id = $1
    ) counts
    WHERE b.id = $1
    `,
    [batchId, changedBy]
  );
}

export async function createItemPricingUpdateBatch(
  input: ItemPricingCreateUpdateBatchInput
): Promise<ItemPricingUpdateBatchDetail> {
  const priceBookId = await resolvePriceBookId(db, input.priceBookId ?? null);
  const name = cleanRequiredText(input.name, "Batch name");
  const updateType = cleanUpdateType(input.updateType);
  const adjustmentType = updateType === "INDIVIDUAL_ITEM" || updateType === "CSV_UPLOAD"
    ? "SET_PRICE"
    : cleanAdjustmentType(input.adjustmentType || "ADD_AMOUNT");
  const adjustmentValue = adjustmentType === "SET_PRICE" ? null : cleanNumberNullable(input.adjustmentValue, "Adjustment value");
  const criteria = normalizeCriteria(input.criteria ?? null);
  const changedBy = userName(input);

  let rows = input.rows ?? [];
  if (updateType === "CSV_UPLOAD") rows = parseItemPricingUpdateCsv(input.csvText);

  const client = await db.connect();
  let batchId = "";

  try {
    await client.query("BEGIN");

    const builtRows = await buildUpdateRows(client, {
      priceBookId,
      updateType,
      adjustmentType,
      adjustmentValue,
      criteria,
      rows,
    });

    const created = await client.query<{ id: string }>(
      `
      INSERT INTO public.item_pricing_update_batches (
        price_book_id, name, update_type, adjustment_type, adjustment_value,
        criteria_json, notes, created_by, validated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8)
      RETURNING id
      `,
      [priceBookId, name, updateType, adjustmentType, adjustmentValue, JSON.stringify(criteria), cleanText(input.notes), changedBy]
    );

    batchId = created.rows[0].id;
    await insertUpdateRows(client, batchId, builtRows);
    await recalcBatchCounts(client, batchId, changedBy);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const detail = await getItemPricingUpdateBatch(batchId);
  if (!detail) throw new Error("Failed to reload update batch.");

  await logUpdateActivity({
    entityType: "item_pricing_update_batch",
    entityId: detail.id,
    eventType: "created",
    message: `${detail.batchNumber} created with ${detail.rowCount} row(s).`,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    newValue: detail,
  });

  return detail;
}

export async function applyItemPricingUpdateBatch(
  input: ItemPricingApplyUpdateBatchInput
): Promise<ItemPricingUpdateBatchDetail> {
  const batchId = cleanRequiredText(input.batchId, "Update Batch");
  const changedBy = userName(input);
  const saveSnapshots = cleanBool(input.saveCalculatedSnapshots, true);

  const existing = await getItemPricingUpdateBatch(batchId);
  if (!existing) throw new Error("Update batch not found.");
  if (existing.status === "APPLIED") throw new Error("This update batch has already been applied.");
  if (existing.status === "VOIDED" || existing.isVoided) throw new Error("Voided update batches cannot be applied.");
  if (existing.errorRowCount > 0) throw new Error("Fix or remove error rows before applying this update batch.");

  const applicableRows = existing.rows.filter((row) => row.status === "VALID" || row.status === "WARNING");
  if (applicableRows.length === 0) throw new Error("No valid rows are available to apply.");

  const client = await db.connect();
  const appliedItemIds: string[] = [];
  let appliedCount = 0;
  let skippedCount = 0;

  try {
    await client.query("BEGIN");

    for (const row of applicableRows) {
      if (!row.itemId || row.newBlankEqp === null || row.newBlankEqp === undefined) {
        skippedCount += 1;
        await client.query(
          `UPDATE public.item_pricing_update_batch_rows SET status = 'SKIPPED', error_message = 'Missing item or new Blank EQP.' WHERE id = $1`,
          [row.id]
        );
        continue;
      }

      await client.query(
        `
        INSERT INTO public.item_pricing_item_base_prices (
          price_book_id, item_id, blank_eqp_price, notes, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $5)
        ON CONFLICT (price_book_id, item_id)
        DO UPDATE SET
          blank_eqp_price = EXCLUDED.blank_eqp_price,
          notes = EXCLUDED.notes,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by
        `,
        [existing.priceBookId, row.itemId, row.newBlankEqp, `Applied from update batch ${existing.batchNumber}.`, changedBy]
      );

      await client.query(
        `UPDATE public.item_pricing_update_batch_rows SET status = 'APPLIED', applied_at = now() WHERE id = $1`,
        [row.id]
      );

      appliedItemIds.push(row.itemId);
      appliedCount += 1;
    }

    await client.query(
      `
      UPDATE public.item_pricing_update_batches
      SET status = CASE WHEN $3::int > 0 THEN 'FAILED' ELSE 'APPLIED' END,
          applied_row_count = $2,
          skipped_row_count = $3,
          applied_at = now(),
          applied_by = $4
      WHERE id = $1
      `,
      [existing.id, appliedCount, skippedCount, changedBy]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  let snapshotErrorCount = 0;
  if (saveSnapshots && appliedItemIds.length > 0) {
    for (const itemId of appliedItemIds) {
      try {
        const preview = await calculateItemPricingPreview({ priceBookId: existing.priceBookId, itemId });
        await saveItemPricingCalculatedSnapshot(preview, { changedBy });
      } catch {
        snapshotErrorCount += 1;
      }
    }

    if (snapshotErrorCount > 0) {
      await db.query(
        `UPDATE public.item_pricing_update_batches SET snapshot_error_count = $2 WHERE id = $1`,
        [existing.id, snapshotErrorCount]
      );
    }
  }

  const detail = await getItemPricingUpdateBatch(existing.id);
  if (!detail) throw new Error("Failed to reload applied update batch.");

  await logUpdateActivity({
    entityType: "item_pricing_update_batch",
    entityId: detail.id,
    eventType: "updated",
    message: `${detail.batchNumber} applied: ${appliedCount} row(s) applied, ${skippedCount} skipped${snapshotErrorCount ? `, ${snapshotErrorCount} snapshot errors` : ""}.`,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    previousValue: existing,
    newValue: detail,
  });

  return detail;
}
