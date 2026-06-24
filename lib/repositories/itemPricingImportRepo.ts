// lib/repositories/itemPricingImportRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { calculateItemPricingPreview, saveItemPricingCalculatedSnapshot } from "@/lib/repositories/itemPricingRepo";
import { parseItemPricingCsv } from "@/lib/itemPricing/itemPricingCsvImportService";
import type {
  ItemPricingApplyImportInput,
  ItemPricingImportBatch,
  ItemPricingImportBatchDetail,
  ItemPricingImportCounts,
  ItemPricingImportRow,
  ItemPricingStageCsvImportInput,
  ParsedItemPricingImportRow,
} from "@/lib/itemPricing/importTypes";
import type { ItemPricingListOptions, SortDir } from "@/lib/itemPricing/types";

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
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

function cleanCode(value: unknown): string | null {
  const s = cleanText(value);
  if (!s) return null;
  return s.toUpperCase().replace(/[\s\-]+/g, "_");
}

function cleanBool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function cleanNullableBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return null;
}

function cleanMoneyOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().replace(/[$,]/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
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

async function logImportActivity(input: {
  entityType: string;
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
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    fieldName: null,
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
  const cleanId = cleanText(id);

  if (!cleanId) {
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

  const { rows } = await queryable.query<{ id: string }>(
    `SELECT id FROM public.item_pricing_price_books WHERE id = $1 AND is_voided = false LIMIT 1`,
    [cleanId]
  );
  if (!rows[0]) throw new Error("Invalid price book.");
  return rows[0].id;
}

const IMPORT_BATCH_SORT_COLUMNS: Record<string, string> = {
  createdAt: "b.created_at",
  status: "b.status",
  fileName: "b.file_name",
  rowCount: "b.row_count",
  appliedAt: "b.applied_at",
};

function importBatchSelectSql() {
  return `
    SELECT
      b.id,
      b.price_book_id AS "priceBookId",
      pb.code AS "priceBookCode",
      pb.name AS "priceBookName",
      b.import_type AS "importType",
      b.status,
      b.file_name AS "fileName",
      b.source_sheet_name AS "sourceSheetName",
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
      b.applied_by AS "appliedBy"
    FROM public.item_pricing_import_batches b
    JOIN public.item_pricing_price_books pb ON pb.id = b.price_book_id
  `;
}

function importRowSelectSql() {
  return `
    SELECT
      r.id,
      r.batch_id AS "batchId",
      r.row_number AS "rowNumber",
      r.item_code AS "itemCode",
      r.item_description AS "itemDescription",
      r.product_family AS "productFamily",
      r.rule_set_code AS "ruleSetCode",
      r.rule_set_id AS "ruleSetId",
      r.blank_eqp_price::float8 AS "blankEqpPrice",
      r.active,
      r.allows_blank_override AS "allowsBlankOverride",
      r.allows_flat_emb_override AS "allowsFlatEmbOverride",
      r.allows_3d_emb_override AS "allows3dEmbOverride",
      r.allows_knit_in_override AS "allowsKnitInOverride",
      r.notes,
      r.source_file_name AS "sourceFileName",
      r.source_sheet_name AS "sourceSheetName",
      r.status,
      r.error_message AS "errorMessage",
      r.warning_message AS "warningMessage",
      r.existing_item_id AS "existingItemId",
      r.applied_item_id AS "appliedItemId",
      r.applied_base_price_id AS "appliedBasePriceId",
      r.created_at AS "createdAt",
      r.applied_at AS "appliedAt"
    FROM public.item_pricing_import_rows r
  `;
}

export async function listItemPricingImportBatches(
  options: ItemPricingListOptions = {}
): Promise<{ rows: ItemPricingImportBatch[]; total: number; pageSize: number; offset: number }> {
  const params: any[] = [];
  const where: string[] = [];
  const limit = cleanLimit(options.limit);
  const offset = cleanOffset(options.offset);

  const priceBookId = cleanText(options.priceBookId);
  if (priceBookId) {
    params.push(priceBookId);
    where.push(`b.price_book_id = $${params.length}`);
  }

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(COALESCE(b.file_name, '') ILIKE $${params.length} OR b.status ILIKE $${params.length} OR pb.code ILIKE $${params.length})`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortColumn = IMPORT_BATCH_SORT_COLUMNS[String(options.sortBy || "createdAt")] || "b.created_at";
  const sortDir = cleanSortDir(options.sortDir);

  const count = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM public.item_pricing_import_batches b
    JOIN public.item_pricing_price_books pb ON pb.id = b.price_book_id
    ${sqlWhere}
    `,
    params
  );

  params.push(limit, offset);

  const { rows } = await db.query<ItemPricingImportBatch>(
    `
    ${importBatchSelectSql()}
    ${sqlWhere}
    ORDER BY ${sortColumn} ${sortDir}, b.created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
    `,
    params
  );

  return { rows, total: Number(count.rows[0]?.count || 0), pageSize: limit, offset };
}

export async function getItemPricingImportBatch(id: string): Promise<ItemPricingImportBatchDetail | null> {
  const batchId = cleanRequiredText(id, "Import Batch");
  const batch = await db.query<ItemPricingImportBatch>(
    `${importBatchSelectSql()} WHERE b.id = $1 LIMIT 1`,
    [batchId]
  );

  if (!batch.rows[0]) return null;

  const rows = await db.query<ItemPricingImportRow>(
    `${importRowSelectSql()} WHERE r.batch_id = $1 ORDER BY r.row_number ASC`,
    [batchId]
  );

  return { ...batch.rows[0], rows: rows.rows };
}

async function loadRuleSetMap(queryable: Queryable) {
  const ruleSets = await queryable.query<{
    id: number;
    code: string;
    name: string;
    active: boolean;
    allows3dEmb: boolean;
  }>(
    `
    SELECT
      id,
      code,
      name,
      active,
      allows_3d_emb AS "allows3dEmb"
    FROM public.item_pricing_rule_sets
    `
  );

  return new Map(ruleSets.rows.map((row) => [row.code.toUpperCase(), row]));
}

async function loadExistingItemMap(queryable: Queryable) {
  const items = await queryable.query<{
    id: string;
    itemCode: string;
    itemDescription: string | null;
    ruleSetId: number;
    ruleSetCode: string;
    active: boolean;
    isVoided: boolean;
  }>(
    `
    SELECT
      i.id,
      i.item_code AS "itemCode",
      i.item_description AS "itemDescription",
      i.rule_set_id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      i.active,
      i.is_voided AS "isVoided"
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    WHERE i.is_voided = false
    `
  );

  return new Map(items.rows.map((row) => [row.itemCode.toUpperCase(), row]));
}

function validateParsedRows(input: {
  rows: ParsedItemPricingImportRow[];
  ruleSetMap: Awaited<ReturnType<typeof loadRuleSetMap>>;
  existingItemMap: Awaited<ReturnType<typeof loadExistingItemMap>>;
  fileName: string | null;
  sourceSheetName: string | null;
}) {
  const seen = new Set<string>();

  return input.rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const itemCode = cleanText(row.itemCode)?.toUpperCase() ?? null;
    const ruleSetCode = cleanCode(row.ruleSetCode);
    const blankEqpPrice = cleanMoneyOrNull(row.blankEqpPriceRaw);
    const active = row.activeRaw === null ? true : cleanBool(row.activeRaw, true);
    const allowsBlankOverride = cleanNullableBool(row.allowsBlankOverrideRaw);
    const allowsFlatEmbOverride = cleanNullableBool(row.allowsFlatEmbOverrideRaw);
    const allows3dEmbOverride = cleanNullableBool(row.allows3dEmbOverrideRaw);
    const allowsKnitInOverride = cleanNullableBool(row.allowsKnitInOverrideRaw);

    if (!itemCode) errors.push("Item Code is required.");
    if (!ruleSetCode) errors.push("Rule Set Code is required.");
    if (blankEqpPrice === null) errors.push("Blank EQP 2500+ is required and must be numeric.");
    if (blankEqpPrice !== null && blankEqpPrice < 0) errors.push("Blank EQP 2500+ cannot be negative.");

    const duplicateKey = itemCode || `row-${row.rowNumber}`;
    if (itemCode && seen.has(duplicateKey)) errors.push(`Duplicate item code ${itemCode} in import file.`);
    if (itemCode) seen.add(duplicateKey);

    const ruleSet = ruleSetCode ? input.ruleSetMap.get(ruleSetCode) : null;
    if (ruleSetCode && !ruleSet) errors.push(`Unknown rule set code ${ruleSetCode}.`);
    if (ruleSet && !ruleSet.active) errors.push(`Rule set ${ruleSet.name} is inactive.`);

    const existing = itemCode ? input.existingItemMap.get(itemCode) : null;
    if (existing && ruleSet && existing.ruleSetId !== ruleSet.id) {
      warnings.push(`Existing item is currently assigned to ${existing.ruleSetCode}; import will change it to ${ruleSet.code}.`);
    }
    if (existing && existing.active === false && active) {
      warnings.push("Existing item is inactive; import will reactivate it.");
    }

    if (itemCode === "I8507" && allows3dEmbOverride !== false) {
      warnings.push("I8507 should not allow 3D pricing. Import will force Allows 3D Override to false.");
    }

    const finalAllows3dOverride = itemCode === "I8507" ? false : allows3dEmbOverride;

    const status = errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "VALID";

    return {
      rowNumber: row.rowNumber,
      itemCode,
      itemDescription: cleanText(row.itemDescription),
      productFamily: cleanText(row.productFamily),
      ruleSetCode,
      ruleSetId: ruleSet?.id ?? null,
      blankEqpPrice,
      active,
      allowsBlankOverride,
      allowsFlatEmbOverride,
      allows3dEmbOverride: finalAllows3dOverride,
      allowsKnitInOverride,
      notes: cleanText(row.notes),
      sourceFileName: input.fileName,
      sourceSheetName: input.sourceSheetName,
      status,
      errorMessage: errors.length ? errors.join(" ") : null,
      warningMessage: warnings.length ? warnings.join(" ") : null,
      existingItemId: existing?.id ?? null,
    };
  });
}

function countImportRows(rows: Array<{ status: string }>): ItemPricingImportCounts {
  return rows.reduce(
    (acc, row) => {
      acc.rowCount += 1;
      if (row.status === "VALID") acc.validRowCount += 1;
      if (row.status === "WARNING") acc.warningRowCount += 1;
      if (row.status === "ERROR") acc.errorRowCount += 1;
      return acc;
    },
    { rowCount: 0, validRowCount: 0, warningRowCount: 0, errorRowCount: 0 }
  );
}

export async function stageItemPricingCsvImport(
  input: ItemPricingStageCsvImportInput
): Promise<ItemPricingImportBatchDetail> {
  const parsedRows = parseItemPricingCsv(input.csvText);
  const priceBookId = await resolvePriceBookId(db, input.priceBookId ?? null);
  const fileName = cleanText(input.fileName) || "item-pricing-import.csv";
  const sourceSheetName = cleanText(input.sourceSheetName);
  const changedBy = userName(input);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const ruleSetMap = await loadRuleSetMap(client);
    const existingItemMap = await loadExistingItemMap(client);
    const stagedRows = validateParsedRows({ rows: parsedRows, ruleSetMap, existingItemMap, fileName, sourceSheetName });
    const counts = countImportRows(stagedRows);
    const batchStatus = counts.errorRowCount > 0 ? "STAGED" : "VALIDATED";

    const batch = await client.query<{ id: string }>(
      `
      INSERT INTO public.item_pricing_import_batches (
        price_book_id,
        import_type,
        status,
        file_name,
        source_sheet_name,
        notes,
        row_count,
        valid_row_count,
        warning_row_count,
        error_row_count,
        created_by,
        validated_at,
        validated_by
      )
      VALUES ($1, 'BASE_PRICE_CSV', $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $10)
      RETURNING id
      `,
      [
        priceBookId,
        batchStatus,
        fileName,
        sourceSheetName,
        cleanText(input.notes),
        counts.rowCount,
        counts.validRowCount,
        counts.warningRowCount,
        counts.errorRowCount,
        changedBy,
      ]
    );

    for (const row of stagedRows) {
      await client.query(
        `
        INSERT INTO public.item_pricing_import_rows (
          batch_id,
          row_number,
          item_code,
          item_description,
          product_family,
          rule_set_code,
          rule_set_id,
          blank_eqp_price,
          active,
          allows_blank_override,
          allows_flat_emb_override,
          allows_3d_emb_override,
          allows_knit_in_override,
          notes,
          source_file_name,
          source_sheet_name,
          status,
          error_message,
          warning_message,
          existing_item_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        `,
        [
          batch.rows[0].id,
          row.rowNumber,
          row.itemCode,
          row.itemDescription,
          row.productFamily,
          row.ruleSetCode,
          row.ruleSetId,
          row.blankEqpPrice,
          row.active,
          row.allowsBlankOverride,
          row.allowsFlatEmbOverride,
          row.allows3dEmbOverride,
          row.allowsKnitInOverride,
          row.notes,
          row.sourceFileName,
          row.sourceSheetName,
          row.status,
          row.errorMessage,
          row.warningMessage,
          row.existingItemId,
        ]
      );
    }

    await client.query("COMMIT");

    const detail = await getItemPricingImportBatch(batch.rows[0].id);
    if (!detail) throw new Error("Failed to reload import batch.");

    await logImportActivity({
      entityType: "item_pricing_import_batch",
      entityId: detail.id,
      eventType: "created",
      message: `Item pricing import staged from ${fileName}: ${counts.validRowCount} valid, ${counts.warningRowCount} warnings, ${counts.errorRowCount} errors.`,
      changedBy: input.changedBy,
      changedByUserId: input.changedByUserId,
      changedByEmployeeNumber: input.changedByEmployeeNumber,
      newValue: detail,
    });

    return detail;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function upsertImportedItem(
  queryable: Queryable,
  row: ItemPricingImportRow,
  changedBy: string
): Promise<string> {
  const itemCode = cleanRequiredText(row.itemCode, "Item Code").toUpperCase();
  if (!row.ruleSetId) throw new Error(`Row ${row.rowNumber}: Rule Set is required.`);

  const existing = await queryable.query<{ id: string }>(
    `SELECT id FROM public.item_pricing_items WHERE upper(item_code) = upper($1) AND is_voided = false LIMIT 1`,
    [itemCode]
  );

  if (existing.rows[0]) {
    await queryable.query(
      `
      UPDATE public.item_pricing_items
      SET item_description = $2,
          product_family = $3,
          rule_set_id = $4,
          active = $5,
          allows_blank_override = $6,
          allows_flat_emb_override = $7,
          allows_3d_emb_override = $8,
          allows_knit_in_override = $9,
          notes = COALESCE($10, notes),
          updated_at = now(),
          updated_by = $11
      WHERE id = $1
      `,
      [
        existing.rows[0].id,
        cleanText(row.itemDescription),
        cleanText(row.productFamily),
        row.ruleSetId,
        row.active ?? true,
        row.allowsBlankOverride,
        row.allowsFlatEmbOverride,
        row.allows3dEmbOverride,
        row.allowsKnitInOverride,
        cleanText(row.notes),
        changedBy,
      ]
    );

    return existing.rows[0].id;
  }

  const created = await queryable.query<{ id: string }>(
    `
    INSERT INTO public.item_pricing_items (
      item_code,
      item_description,
      product_family,
      rule_set_id,
      active,
      allows_blank_override,
      allows_flat_emb_override,
      allows_3d_emb_override,
      allows_knit_in_override,
      notes,
      created_by,
      updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
    RETURNING id
    `,
    [
      itemCode,
      cleanText(row.itemDescription),
      cleanText(row.productFamily),
      row.ruleSetId,
      row.active ?? true,
      row.allowsBlankOverride,
      row.allowsFlatEmbOverride,
      row.allows3dEmbOverride,
      row.allowsKnitInOverride,
      cleanText(row.notes),
      changedBy,
    ]
  );

  return created.rows[0].id;
}

async function upsertImportedBasePrice(
  queryable: Queryable,
  input: {
    priceBookId: string;
    itemId: string;
    row: ItemPricingImportRow;
    changedBy: string;
  }
): Promise<string> {
  if (input.row.blankEqpPrice === null || input.row.blankEqpPrice === undefined) {
    throw new Error(`Row ${input.row.rowNumber}: Blank EQP is required.`);
  }

  const saved = await queryable.query<{ id: string }>(
    `
    INSERT INTO public.item_pricing_item_base_prices (
      price_book_id,
      item_id,
      blank_eqp_price,
      source_file_name,
      source_sheet_name,
      source_row_number,
      notes,
      created_by,
      updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
    ON CONFLICT (price_book_id, item_id)
    DO UPDATE SET
      blank_eqp_price = EXCLUDED.blank_eqp_price,
      source_file_name = EXCLUDED.source_file_name,
      source_sheet_name = EXCLUDED.source_sheet_name,
      source_row_number = EXCLUDED.source_row_number,
      notes = EXCLUDED.notes,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by
    RETURNING id
    `,
    [
      input.priceBookId,
      input.itemId,
      input.row.blankEqpPrice,
      input.row.sourceFileName,
      input.row.sourceSheetName,
      input.row.rowNumber,
      input.row.notes,
      input.changedBy,
    ]
  );

  return saved.rows[0].id;
}

export async function applyItemPricingImportBatch(
  input: ItemPricingApplyImportInput
): Promise<ItemPricingImportBatchDetail> {
  const batchId = cleanRequiredText(input.batchId, "Import Batch");
  const changedBy = userName(input);
  const saveSnapshots = cleanBool(input.saveCalculatedSnapshots, true);

  const existing = await getItemPricingImportBatch(batchId);
  if (!existing) throw new Error("Import batch not found.");
  if (existing.status === "APPLIED") throw new Error("This import batch has already been applied.");
  if (existing.status === "VOIDED") throw new Error("Voided import batches cannot be applied.");
  if (existing.errorRowCount > 0) throw new Error("Fix or remove error rows before applying this import batch.");

  const applicableRows = existing.rows.filter((row) => row.status === "VALID" || row.status === "WARNING");
  if (applicableRows.length === 0) throw new Error("No valid rows are available to apply.");

  const client = await db.connect();
  const appliedItemIds: string[] = [];
  let appliedCount = 0;
  let skippedCount = 0;

  try {
    await client.query("BEGIN");

    for (const row of applicableRows) {
      try {
        const itemId = await upsertImportedItem(client, row, changedBy);
        const basePriceId = await upsertImportedBasePrice(client, {
          priceBookId: existing.priceBookId,
          itemId,
          row,
          changedBy,
        });

        await client.query(
          `
          UPDATE public.item_pricing_import_rows
          SET status = 'APPLIED',
              applied_item_id = $2,
              applied_base_price_id = $3,
              applied_at = now()
          WHERE id = $1
          `,
          [row.id, itemId, basePriceId]
        );

        appliedItemIds.push(itemId);
        appliedCount += 1;
      } catch (rowError: any) {
        skippedCount += 1;
        await client.query(
          `
          UPDATE public.item_pricing_import_rows
          SET status = 'SKIPPED',
              error_message = $2
          WHERE id = $1
          `,
          [row.id, rowError?.message || "Row failed during apply."]
        );
      }
    }

    await client.query(
      `
      UPDATE public.item_pricing_import_batches
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
        const preview = await calculateItemPricingPreview({
          priceBookId: existing.priceBookId,
          itemId,
        });
        await saveItemPricingCalculatedSnapshot(preview, { changedBy });
      } catch {
        snapshotErrorCount += 1;
      }
    }

    if (snapshotErrorCount > 0) {
      await db.query(
        `UPDATE public.item_pricing_import_batches SET snapshot_error_count = $2 WHERE id = $1`,
        [existing.id, snapshotErrorCount]
      );
    }
  }

  const detail = await getItemPricingImportBatch(existing.id);
  if (!detail) throw new Error("Failed to reload applied import batch.");

  await logImportActivity({
    entityType: "item_pricing_import_batch",
    entityId: detail.id,
    eventType: "updated",
    message: `Item pricing import applied: ${appliedCount} rows applied, ${skippedCount} skipped${snapshotErrorCount ? `, ${snapshotErrorCount} snapshot errors` : ""}.`,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    previousValue: existing,
    newValue: detail,
  });

  return detail;
}
