import { db } from "@/lib/db";

export type QCRepoOptions = {
  includeVoided?: boolean;
  onlyVoided?: boolean;
};

export type QCSubmission = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  salesOrder: string | null; // display value for UI compatibility
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  notes: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: string;
};

export type QCLine = {
  id: string;
  submissionId: string;
  entryTs: string;
  entryDate: string;

  name: string;
  employeeNumber: number;

  salesOrder: string | null; // display value for UI compatibility
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;

  detailNumber: number | null;
  flatOr3d: string | null;

  orderQuantity: number | null;
  inspectedQuantity: number | null;
  rejectedQuantity: number | null;
  quantityShipped: number | null;

  notes: string | null;
  createdAt: string;
};

function resolveVoidWhere(alias: string, options?: QCRepoOptions): string {
  const col = `${alias}.is_voided`;

  if (options?.onlyVoided) {
    return `COALESCE(${col}, false) = true`;
  }

  if (options?.includeVoided) {
    return `1=1`;
  }

  return `COALESCE(${col}, false) = false`;
}

export async function createQCSubmission(input: {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;
  notes: string | null;
}): Promise<{ id: string }> {
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.qc_daily_submissions (
      entry_ts,
      name,
      employee_number,
      sales_order,
      sales_order_base,
      sales_order_display,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id
    `,
    [
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.legacySalesOrder,
      input.salesOrderBase,
      input.salesOrderDisplay,
      input.notes,
    ]
  );

  return rows[0];
}

export async function addQCLinesBulk(input: {
  submissionId: string;
  entryTs: Date;
  name: string;
  employeeNumber: number;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;
  lines: Array<{
    detailNumber: number | null;
    flatOr3d: string | null;
    orderQuantity: number | null;
    inspectedQuantity: number | null;
    rejectedQuantity: number | null;
    quantityShipped: number | null;
    notes: string | null;
  }>;
}): Promise<{ ids: string[] }> {
  if (input.lines.length === 0) return { ids: [] };

  const ids: string[] = [];

  for (const l of input.lines) {
    const { rows } = await db.query<{ id: string }>(
      `
      INSERT INTO public.qc_daily_entries (
        submission_id,
        entry_ts,
        name,
        employee_number,
        sales_order,
        sales_order_base,
        sales_order_display,
        detail_number,
        flat_or_3d,
        order_quantity,
        inspected_quantity,
        rejected_quantity,
        quantity_shipped,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id
      `,
      [
        input.submissionId,
        input.entryTs,
        input.name,
        input.employeeNumber,
        input.legacySalesOrder,
        input.salesOrderBase,
        input.salesOrderDisplay,
        l.detailNumber,
        l.flatOr3d,
        l.orderQuantity,
        l.inspectedQuantity,
        l.rejectedQuantity,
        l.quantityShipped,
        l.notes,
      ]
    );

    ids.push(rows[0].id);
  }

  return { ids };
}

export async function getQCSubmissionWithLines(
  submissionId: string,
  options?: QCRepoOptions
): Promise<{
  submission: QCSubmission | null;
  lines: QCLine[];
}> {
  const subRes = await db.query<QCSubmission>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      entry_date AS "entryDate",
      name,
      employee_number AS "employeeNumber",
      COALESCE(sales_order_display, sales_order::text) AS "salesOrder",
      sales_order_base AS "salesOrderBase",
      sales_order_display AS "salesOrderDisplay",
      notes,
      COALESCE(is_voided, false) AS "isVoided",
      voided_at AS "voidedAt",
      voided_by AS "voidedBy",
      void_reason AS "voidReason",
      created_at AS "createdAt"
    FROM public.qc_daily_submissions s
    WHERE s.id = $1
      AND ${resolveVoidWhere("s", options)}
    LIMIT 1
    `,
    [submissionId]
  );

  const submission = subRes.rows[0] ?? null;
  if (!submission) return { submission: null, lines: [] };

  const linesRes = await db.query<QCLine>(
    `
    SELECT
      id,
      submission_id AS "submissionId",
      entry_ts AS "entryTs",
      entry_date AS "entryDate",
      name,
      employee_number AS "employeeNumber",
      COALESCE(sales_order_display, sales_order::text) AS "salesOrder",
      sales_order_base AS "salesOrderBase",
      sales_order_display AS "salesOrderDisplay",
      detail_number AS "detailNumber",
      flat_or_3d AS "flatOr3d",
      order_quantity AS "orderQuantity",
      inspected_quantity AS "inspectedQuantity",
      rejected_quantity AS "rejectedQuantity",
      quantity_shipped AS "quantityShipped",
      notes,
      created_at AS "createdAt"
    FROM public.qc_daily_entries
    WHERE submission_id = $1
    ORDER BY created_at ASC, id ASC
    `,
    [submissionId]
  );

  return { submission, lines: linesRes.rows };
}

export async function replaceQCSubmission(input: {
  submissionId: string;
  entryTs: Date;
  name: string;
  employeeNumber: number;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;
  notes: string | null;
  lines: Array<{
    detailNumber: number | null;
    flatOr3d: string | null;
    orderQuantity: number | null;
    inspectedQuantity: number | null;
    rejectedQuantity: number | null;
    quantityShipped: number | null;
    notes: string | null;
  }>;
}): Promise<{ count: number }> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ isVoided: boolean }>(
      `
      SELECT COALESCE(is_voided, false) AS "isVoided"
      FROM public.qc_daily_submissions
      WHERE id = $1
      LIMIT 1
      `,
      [input.submissionId]
    );

    const current = existing.rows[0];

    if (!current) {
      throw new Error("Submission not found.");
    }

    if (current.isVoided) {
      throw new Error("Voided submissions cannot be edited.");
    }

    await client.query(
      `
      UPDATE public.qc_daily_submissions
      SET
        entry_ts = $2,
        name = $3,
        employee_number = $4,
        sales_order = $5,
        sales_order_base = $6,
        sales_order_display = $7,
        notes = $8
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      `,
      [
        input.submissionId,
        input.entryTs,
        input.name,
        input.employeeNumber,
        input.legacySalesOrder,
        input.salesOrderBase,
        input.salesOrderDisplay,
        input.notes,
      ]
    );

    await client.query(
      `DELETE FROM public.qc_daily_entries WHERE submission_id = $1`,
      [input.submissionId]
    );

    const ids: string[] = [];

    for (const l of input.lines) {
      const { rows } = await client.query<{ id: string }>(
        `
        INSERT INTO public.qc_daily_entries (
          submission_id,
          entry_ts,
          name,
          employee_number,
          sales_order,
          sales_order_base,
          sales_order_display,
          detail_number,
          flat_or_3d,
          order_quantity,
          inspected_quantity,
          rejected_quantity,
          quantity_shipped,
          notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id
        `,
        [
          input.submissionId,
          input.entryTs,
          input.name,
          input.employeeNumber,
          input.legacySalesOrder,
          input.salesOrderBase,
          input.salesOrderDisplay,
          l.detailNumber,
          l.flatOr3d,
          l.orderQuantity,
          l.inspectedQuantity,
          l.rejectedQuantity,
          l.quantityShipped,
          l.notes,
        ]
      );

      ids.push(rows[0].id);
    }

    await client.query("COMMIT");
    return { count: ids.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function voidQCSubmission(input: {
  id: string;
  voidedBy: string;
  reason?: string | null;
}): Promise<boolean> {
  const { rowCount } = await db.query(
    `
    UPDATE public.qc_daily_submissions
    SET
      is_voided = true,
      voided_at = NOW(),
      voided_by = $2,
      void_reason = $3
    WHERE id = $1
      AND COALESCE(is_voided, false) = false
    `,
    [input.id, input.voidedBy, input.reason ?? null]
  );

  return (rowCount ?? 0) > 0;
}

export async function listQCSubmissionsForUserAndSO(input: {
  employeeNumber: number;
  salesOrderBase: string;
}): Promise<Array<{
  id: string;
  entryTs: string;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  notes: string | null;
  lineCount: number;
}>> {
  const { rows } = await db.query(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      COALESCE(s.sales_order_display, s.sales_order::text) AS "salesOrder",
      s.sales_order_base AS "salesOrderBase",
      s.sales_order_display AS "salesOrderDisplay",
      s.notes,
      COUNT(e.id)::int AS "lineCount"
    FROM public.qc_daily_submissions s
    LEFT JOIN public.qc_daily_entries e
      ON e.submission_id = s.id
    WHERE s.employee_number = $1
      AND COALESCE(s.sales_order_base, s.sales_order::text) = $2
      AND COALESCE(s.is_voided, false) = false
    GROUP BY s.id
    ORDER BY s.entry_ts DESC
    `,
    [input.employeeNumber, input.salesOrderBase]
  );

  return rows as any;
}

export async function listQCSubmissionSummariesByEntryDate(input: {
  entryDate: string;
  employeeNumber?: number;
}): Promise<Array<{
  id: string;
  entryTs: string;
  name: string;
  employeeNumber: number;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  notes: string | null;
  lineCount: number;
}>> {
  const params: any[] = [input.entryDate];
  let where = `s.entry_date = $1::date AND COALESCE(s.is_voided, false) = false`;

  if (input.employeeNumber != null) {
    params.push(input.employeeNumber);
    where += ` AND s.employee_number = $2`;
  }

  const { rows } = await db.query(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.name,
      s.employee_number AS "employeeNumber",
      COALESCE(s.sales_order_display, s.sales_order::text) AS "salesOrder",
      s.sales_order_base AS "salesOrderBase",
      s.sales_order_display AS "salesOrderDisplay",
      s.notes,
      COUNT(e.id)::int AS "lineCount"
    FROM public.qc_daily_submissions s
    LEFT JOIN public.qc_daily_entries e
      ON e.submission_id = s.id
    WHERE ${where}
    GROUP BY s.id
    ORDER BY s.entry_ts DESC
    `,
    params
  );

  return rows as any;
}

export type QCSubmissionSummaryRow = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  notes: string | null;
  createdAt: string;
  lineCount: number;
};

export type ListQCSubmissionSummariesArgs = QCRepoOptions & {
  entryDateFrom: string;
  entryDateTo: string;
  employeeNumber?: number;

  name?: string;
  notes?: string;
  salesOrderStartsWith?: string;
  detailStartsWith?: string;

  sortBy?: "entryTs" | "entryDate" | "name" | "salesOrder" | "lineCount";
  sortDir?: "asc" | "desc";
  limit: number;
  offset: number;
};

export async function listQCSubmissionSummariesRange(
  input: ListQCSubmissionSummariesArgs
): Promise<{ rows: QCSubmissionSummaryRow[]; totalCount: number }> {
  const params: any[] = [input.entryDateFrom, input.entryDateTo];

  let where = `s.entry_date BETWEEN $1::date AND $2::date AND ${resolveVoidWhere("s", input)}`;

  if (input.employeeNumber != null) {
    params.push(input.employeeNumber);
    where += ` AND s.employee_number = $${params.length}`;
  }

  if (input.name?.trim()) {
    params.push(`%${input.name.trim()}%`);
    where += ` AND s.name ILIKE $${params.length}`;
  }

  if (input.salesOrderStartsWith?.trim()) {
    params.push(`${input.salesOrderStartsWith.trim()}%`);
    where += `
      AND (
        COALESCE(s.sales_order_base, s.sales_order::text, '') LIKE $${params.length}
        OR COALESCE(s.sales_order_display, s.sales_order::text, '') LIKE $${params.length}
      )
    `;
  }

  if (input.detailStartsWith?.trim()) {
    params.push(`${input.detailStartsWith.trim()}%`);
    where += `
      AND EXISTS (
        SELECT 1
        FROM public.qc_daily_entries e2
        WHERE e2.submission_id = s.id
          AND COALESCE(e2.detail_number::text,'') LIKE $${params.length}
      )
    `;
  }

  if (input.notes?.trim()) {
    params.push(`%${input.notes.trim()}%`);
    where += `
      AND (
        COALESCE(s.notes,'') ILIKE $${params.length}
        OR EXISTS (
          SELECT 1
          FROM public.qc_daily_entries e3
          WHERE e3.submission_id = s.id
            AND COALESCE(e3.notes,'') ILIKE $${params.length}
        )
      )
    `;
  }

  const sortBy = input.sortBy ?? "entryTs";
  const sortDir = input.sortDir === "asc" ? "ASC" : "DESC";

  const ORDER_MAP_B: Record<string, string> = {
    entryTs: `b."entryTs"`,
    entryDate: `b."entryDate"`,
    name: `b."name"`,
    salesOrder: `b."salesOrder"`,
    lineCount: `b."lineCount"`,
  };

  const orderExpr = ORDER_MAP_B[sortBy] ?? ORDER_MAP_B.entryTs;
  const orderBySql = `${orderExpr} ${sortDir}, b."id" DESC`;

  params.push(input.limit);
  const limitParam = `$${params.length}`;
  params.push(input.offset);
  const offsetParam = `$${params.length}`;

  const { rows } = await db.query(
    `
    WITH base AS (
      SELECT
        s.id,
        s.entry_ts AS "entryTs",
        s.entry_date AS "entryDate",
        s.name AS "name",
        s.employee_number AS "employeeNumber",
        COALESCE(s.sales_order_display, s.sales_order::text) AS "salesOrder",
        s.sales_order_base AS "salesOrderBase",
        s.sales_order_display AS "salesOrderDisplay",
        s.notes AS "notes",
        s.created_at AS "createdAt",
        COUNT(e.id)::int AS "lineCount"
      FROM public.qc_daily_submissions s
      LEFT JOIN public.qc_daily_entries e
        ON e.submission_id = s.id
      WHERE ${where}
      GROUP BY s.id
    )
    SELECT
      b.*,
      (SELECT COUNT(*) FROM base)::int AS "totalCount"
    FROM base b
    ORDER BY ${orderBySql}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
    `,
    params
  );

  const totalCount = rows.length ? Number((rows[0] as any).totalCount) : 0;
  const clean = rows.map(({ totalCount: _tc, ...rest }: any) => rest) as QCSubmissionSummaryRow[];

  return { rows: clean, totalCount };
}