import { db } from "@/lib/db";

export type EmbroideryEntry = {
  id: string;
  entryTs: string;
  name: string;

  employeeNumber?: number;
  shift?: string;

  machineNumber: number | null;

  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;

  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  annex?: boolean;
  jobberSamplesRan?: number | null;

  notes: string | null;

  isVoided?: boolean;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
};

export type AddEmbroideryEntryInput = {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  shift: string;

  machineNumber: number | null;

  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;

  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  annex?: boolean;
  jobberSamplesRan?: number | null;

  notes: string | null;
};

export type UpdateEmbroideryEntryInput = {
  id: string;

  entryTs: Date;
  name: string;
  employeeNumber: number;
  shift: string;

  machineNumber: number | null;

  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;

  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  annex?: boolean;
  jobberSamplesRan?: number | null;

  notes: string | null;
};

export async function addEmbroideryEntry(
  input: AddEmbroideryEntryInput
): Promise<{ id: string }> {
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.embroidery_daily_entries (
      entry_ts,
      name,
      employee_number,
      shift,
      machine_number,
      sales_order,
      sales_order_base,
      sales_order_display,
      detail_number,
      embroidery_location,
      stitches,
      pieces,
      is_3d,
      is_knit,
      detail_complete,
      annex,
      jobber_samples_ran,
      notes
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    )
    RETURNING id
    `,
    [
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.legacySalesOrder,
      input.salesOrderBase,
      input.salesOrderDisplay,
      input.detailNumber,
      input.embroideryLocation,
      input.stitches,
      input.pieces,
      input.is3d,
      input.isKnit,
      input.detailComplete,
      !!input.annex,
      input.jobberSamplesRan ?? null,
      input.notes,
    ]
  );

  return rows[0];
}

function entrySelectSql() {
  return `
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      COALESCE(sales_order_display, sales_order::text) AS "salesOrder",
      sales_order_base AS "salesOrderBase",
      sales_order_display AS "salesOrderDisplay",
      detail_number AS "detailNumber",
      embroidery_location AS "embroideryLocation",
      stitches,
      pieces,
      is_3d AS "is3d",
      is_knit AS "isKnit",
      detail_complete AS "detailComplete",
      annex,
      jobber_samples_ran AS "jobberSamplesRan",
      notes,
      COALESCE(is_voided, false) AS "isVoided",
      voided_at AS "voidedAt",
      voided_by AS "voidedBy",
      void_reason AS "voidReason"
    FROM public.embroidery_daily_entries
  `;
}

export async function listEmbroideryEntriesByShiftDate(
  shiftDate: string
): Promise<EmbroideryEntry[]> {
  const { rows } = await db.query<EmbroideryEntry>(
    `
    ${entrySelectSql()}
    WHERE shift_date = $1
      AND COALESCE(is_voided, false) = false
    ORDER BY entry_ts DESC
    `,
    [shiftDate]
  );

  return rows;
}

export async function listEmbroideryEntriesByUserAndShiftDate(
  employeeNumber: number,
  shiftDate: string
): Promise<EmbroideryEntry[]> {
  const { rows } = await db.query<EmbroideryEntry>(
    `
    ${entrySelectSql()}
    WHERE employee_number = $1
      AND shift_date = $2
      AND COALESCE(is_voided, false) = false
    ORDER BY entry_ts DESC
    `,
    [employeeNumber, shiftDate]
  );

  return rows;
}

export async function getEmbroideryEntryById(
  id: string,
  options?: { includeVoided?: boolean }
): Promise<EmbroideryEntry | null> {
  const { rows } = await db.query<EmbroideryEntry>(
    `
    ${entrySelectSql()}
    WHERE id = $1
      AND ($2::boolean = true OR COALESCE(is_voided, false) = false)
    LIMIT 1
    `,
    [id, !!options?.includeVoided]
  );

  return rows[0] ?? null;
}

export async function updateEmbroideryEntry(
  input: UpdateEmbroideryEntryInput
): Promise<void> {
  await db.query(
    `
    UPDATE public.embroidery_daily_entries
    SET
      entry_ts = $2,
      name = $3,
      employee_number = $4,
      shift = $5,
      machine_number = $6,
      sales_order = $7,
      sales_order_base = $8,
      sales_order_display = $9,
      detail_number = $10,
      embroidery_location = $11,
      stitches = $12,
      pieces = $13,
      is_3d = $14,
      is_knit = $15,
      detail_complete = $16,
      annex = $17,
      jobber_samples_ran = $18,
      notes = $19
    WHERE id = $1
      AND COALESCE(is_voided, false) = false
    `,
    [
      input.id,
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.legacySalesOrder,
      input.salesOrderBase,
      input.salesOrderDisplay,
      input.detailNumber,
      input.embroideryLocation,
      input.stitches,
      input.pieces,
      input.is3d,
      input.isKnit,
      input.detailComplete,
      !!input.annex,
      input.jobberSamplesRan ?? null,
      input.notes,
    ]
  );
}

/* ============================================================
   Submission support
   ============================================================ */

export type EmbroiderySubmission = {
  id: string;
  entryTs: string;
  shiftDate?: string;
  name: string;
  employeeNumber: number;
  shift: string;
  machineNumber: number | null;

  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;

  annex: boolean;

  notes: string | null;

  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;

  createdAt: string;
  lineCount?: number;
  totalStitches?: number | null;
  totalPieces?: number | null;
};

export type SubmissionWithLines = {
  submission: EmbroiderySubmission;
  lines: EmbroideryEntry[];
};

function submissionBaseSelectSql() {
  return `
    SELECT
      id,
      entry_ts AS "entryTs",
      ((entry_ts AT TIME ZONE 'America/Chicago') - interval '6 hours')::date AS "shiftDate",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      COALESCE(sales_order_display, sales_order::text) AS "salesOrder",
      sales_order_base AS "salesOrderBase",
      sales_order_display AS "salesOrderDisplay",
      annex,
      notes,
      COALESCE(is_voided, false) AS "isVoided",
      voided_at AS "voidedAt",
      voided_by AS "voidedBy",
      void_reason AS "voidReason",
      created_at AS "createdAt"
    FROM public.embroidery_daily_submissions
  `;
}

export async function createEmbroiderySubmission(input: {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  shift: string;
  machineNumber: number | null;

  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;

  annex: boolean;
  notes: string | null;
}): Promise<{ id: string }> {
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.embroidery_daily_submissions (
      entry_ts,
      name,
      employee_number,
      shift,
      machine_number,
      sales_order,
      sales_order_base,
      sales_order_display,
      annex,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id
    `,
    [
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.legacySalesOrder,
      input.salesOrderBase,
      input.salesOrderDisplay,
      !!input.annex,
      input.notes,
    ]
  );

  return rows[0];
}

export async function addEmbroideryEntriesBulk(input: {
  submissionId: string;
  entryTs: Date;
  name: string;
  employeeNumber: number;
  shift: string;

  machineNumber: number | null;

  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;

  annex: boolean;

  lines: Array<{
    detailNumber: number | null;
    embroideryLocation: string | null;
    stitches: number | null;
    pieces: number | null;
    jobberSamplesRan: number | null;
    is3d: boolean;
    isKnit: boolean;
    detailComplete: boolean;
    notes: string | null;
  }>;
}): Promise<Array<{ id: string }>> {
  if (input.lines.length === 0) return [];

  const values: any[] = [];
  const tuples: string[] = [];

  input.lines.forEach((l, i) => {
    const base = i * 19;
    tuples.push(
      `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16},$${base + 17},$${base + 18},$${base + 19})`
    );

    values.push(
      input.submissionId,
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.legacySalesOrder,
      input.salesOrderBase,
      input.salesOrderDisplay,
      l.detailNumber,
      l.embroideryLocation,
      l.stitches,
      l.pieces,
      l.is3d,
      l.isKnit,
      l.detailComplete,
      !!input.annex,
      l.jobberSamplesRan ?? null,
      l.notes
    );
  });

  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.embroidery_daily_entries (
      submission_id,
      entry_ts,
      name,
      employee_number,
      shift,
      machine_number,
      sales_order,
      sales_order_base,
      sales_order_display,
      detail_number,
      embroidery_location,
      stitches,
      pieces,
      is_3d,
      is_knit,
      detail_complete,
      annex,
      jobber_samples_ran,
      notes
    )
    VALUES ${tuples.join(",")}
    RETURNING id
    `,
    values
  );

  return rows;
}

export async function listEmbroiderySubmissionsForUserAndSO(input: {
  employeeNumber: number;
  salesOrderBase: string;
}): Promise<EmbroiderySubmission[]> {
  const { rows } = await db.query<EmbroiderySubmission>(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      MIN(e.shift_date)::text AS "shiftDate",
      s.name,
      s.employee_number AS "employeeNumber",
      s.shift,
      s.machine_number AS "machineNumber",
      COALESCE(s.sales_order_display, s.sales_order::text) AS "salesOrder",
      s.sales_order_base AS "salesOrderBase",
      s.sales_order_display AS "salesOrderDisplay",
      s.annex AS "annex",
      s.notes,
      COALESCE(s.is_voided, false) AS "isVoided",
      s.voided_at AS "voidedAt",
      s.voided_by AS "voidedBy",
      s.void_reason AS "voidReason",
      s.created_at AS "createdAt",
      COUNT(e.id)::int AS "lineCount",
      COALESCE(SUM(e.stitches), 0)::bigint AS "totalStitches",
      COALESCE(SUM(e.pieces), 0)::bigint AS "totalPieces"
    FROM public.embroidery_daily_submissions s
    JOIN public.embroidery_daily_entries e
      ON e.submission_id = s.id
     AND COALESCE(e.is_voided, false) = false
    WHERE s.employee_number = $1
      AND COALESCE(s.sales_order_base, s.sales_order::text) = $2
      AND COALESCE(s.is_voided, false) = false
    GROUP BY s.id
    ORDER BY s.entry_ts DESC
    `,
    [input.employeeNumber, input.salesOrderBase]
  );

  return rows;
}

export async function getEmbroiderySubmissionWithLines(
  submissionId: string,
  options?: { includeVoided?: boolean }
): Promise<SubmissionWithLines | null> {
  const includeVoided = !!options?.includeVoided;

  const sub = await db.query<EmbroiderySubmission>(
    `
    ${submissionBaseSelectSql()}
    WHERE id = $1
      AND ($2::boolean = true OR COALESCE(is_voided, false) = false)
    LIMIT 1
    `,
    [submissionId, includeVoided]
  );

  const submission = sub.rows[0];
  if (!submission) return null;

  const linesRes = await db.query<EmbroideryEntry>(
    `
    ${entrySelectSql()}
    WHERE submission_id = $1
      AND ($2::boolean = true OR COALESCE(is_voided, false) = false)
    ORDER BY id ASC
    `,
    [submissionId, includeVoided]
  );

  return { submission, lines: linesRes.rows };
}

export async function replaceEmbroiderySubmission(input: {
  submissionId: string;
  entryTs: Date;
  machineNumber: number | null;

  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;

  annex: boolean;
  notes: string | null;

  lines: Array<{
    detailNumber: number | null;
    embroideryLocation: string | null;
    stitches: number | null;
    pieces: number | null;
    jobberSamplesRan: number | null;
    is3d: boolean;
    isKnit: boolean;
    detailComplete: boolean;
    notes: string | null;
  }>;
}): Promise<{ count: number }> {
  await db.query("BEGIN");

  try {
    const { rows: existingRows } = await db.query<{
      isVoided: boolean;
    }>(
      `
      SELECT COALESCE(is_voided, false) AS "isVoided"
      FROM public.embroidery_daily_submissions
      WHERE id = $1
      LIMIT 1
      `,
      [input.submissionId]
    );

    const existing = existingRows[0];

    if (!existing) {
      throw new Error("Submission not found.");
    }

    if (existing.isVoided) {
      throw new Error("Voided submissions cannot be edited.");
    }

    await db.query(
      `
      UPDATE public.embroidery_daily_submissions
      SET
        entry_ts = $2,
        machine_number = $3,
        sales_order = $4,
        sales_order_base = $5,
        sales_order_display = $6,
        annex = $7,
        notes = $8
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      `,
      [
        input.submissionId,
        input.entryTs,
        input.machineNumber,
        input.legacySalesOrder,
        input.salesOrderBase,
        input.salesOrderDisplay,
        !!input.annex,
        input.notes,
      ]
    );

    const { rows: subRows } = await db.query<{
      name: string;
      employeeNumber: number;
      shift: string;
    }>(
      `
      SELECT
        name,
        employee_number AS "employeeNumber",
        shift
      FROM public.embroidery_daily_submissions
      WHERE id = $1
      LIMIT 1
      `,
      [input.submissionId]
    );

    const s = subRows[0];
    if (!s) throw new Error("Submission not found.");

    await db.query(
      `
      DELETE FROM public.embroidery_daily_entries
      WHERE submission_id = $1
      `,
      [input.submissionId]
    );

    await addEmbroideryEntriesBulk({
      submissionId: input.submissionId,
      entryTs: input.entryTs,
      name: s.name,
      employeeNumber: s.employeeNumber,
      shift: s.shift,
      machineNumber: input.machineNumber,
      salesOrderBase: input.salesOrderBase,
      salesOrderDisplay: input.salesOrderDisplay,
      legacySalesOrder: input.legacySalesOrder,
      annex: !!input.annex,
      lines: input.lines.map((l) => ({
        ...l,
        jobberSamplesRan: l.jobberSamplesRan ?? null,
      })),
    });

    await db.query("COMMIT");
    return { count: input.lines.length };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

export async function voidEmbroiderySubmission(input: {
  submissionId: string;
  voidedBy: string;
  voidReason?: string | null;
}): Promise<EmbroiderySubmission | null> {
  await db.query("BEGIN");

  try {
    const result = await db.query<EmbroiderySubmission>(
      `
      UPDATE public.embroidery_daily_submissions
      SET
        is_voided = true,
        voided_at = NOW(),
        voided_by = $2,
        void_reason = $3
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      RETURNING
        id,
        entry_ts AS "entryTs",
        ((entry_ts AT TIME ZONE 'America/Chicago') - interval '6 hours')::date AS "shiftDate",
        name,
        employee_number AS "employeeNumber",
        shift,
        machine_number AS "machineNumber",
        COALESCE(sales_order_display, sales_order::text) AS "salesOrder",
        sales_order_base AS "salesOrderBase",
        sales_order_display AS "salesOrderDisplay",
        annex,
        notes,
        COALESCE(is_voided, false) AS "isVoided",
        voided_at AS "voidedAt",
        voided_by AS "voidedBy",
        void_reason AS "voidReason",
        created_at AS "createdAt"
      `,
      [input.submissionId, input.voidedBy, input.voidReason ?? null]
    );

    const row = result.rows[0] ?? null;

    if (row) {
      await db.query(
        `
        UPDATE public.embroidery_daily_entries
        SET
          is_voided = true,
          voided_at = NOW(),
          voided_by = $2,
          void_reason = $3
        WHERE submission_id = $1
          AND COALESCE(is_voided, false) = false
        `,
        [input.submissionId, input.voidedBy, input.voidReason ?? null]
      );
    }

    await db.query("COMMIT");
    return row;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

export type EmbroiderySubmissionSummaryRow = {
  id: string;
  entryTs: string;
  shiftDate: string;
  name: string;
  machineNumber: number | null;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  lineCount: number;
  totalStitches: number | null;
  totalPieces: number | null;
  notes: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type ListEmbroiderySubmissionSummariesArgs = {
  shiftDateFrom: string;
  shiftDateTo: string;
  employeeNumber?: number;

  name?: string;
  machineNumber?: string;
  salesOrderStartsWith?: string;
  notes?: string;

  sortBy?:
    | "shiftDate"
    | "entryTs"
    | "name"
    | "machineNumber"
    | "salesOrder"
    | "lineCount"
    | "totalStitches"
    | "totalPieces"
    | "isVoided";
  sortDir?: "asc" | "desc";
  limit: number;
  offset: number;
};

export async function listEmbroiderySubmissionSummariesRange(
  input: ListEmbroiderySubmissionSummariesArgs
): Promise<{ rows: EmbroiderySubmissionSummaryRow[]; totalCount: number }> {
  const params: any[] = [input.shiftDateFrom, input.shiftDateTo];

  let where = `
    e.shift_date BETWEEN $1::date AND $2::date
    AND COALESCE(s.is_voided, false) = false
    AND COALESCE(e.is_voided, false) = false
  `;

  if (input.employeeNumber != null) {
    params.push(input.employeeNumber);
    where += ` AND s.employee_number = $${params.length}`;
  }

  if (input.name?.trim()) {
    params.push(`%${input.name.trim()}%`);
    where += ` AND s.name ILIKE $${params.length}`;
  }

  if (input.machineNumber?.trim()) {
    params.push(`${input.machineNumber.trim()}%`);
    where += ` AND COALESCE(s.machine_number::text, '') LIKE $${params.length}`;
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

  if (input.notes?.trim()) {
    params.push(`%${input.notes.trim()}%`);
    where += `
      AND (
        COALESCE(s.notes,'') ILIKE $${params.length}
        OR EXISTS (
          SELECT 1
          FROM public.embroidery_daily_entries e2
          WHERE e2.submission_id = s.id
            AND COALESCE(e2.is_voided, false) = false
            AND COALESCE(e2.notes,'') ILIKE $${params.length}
        )
      )
    `;
  }

  const sortBy = input.sortBy ?? "entryTs";
  const sortDir = input.sortDir === "asc" ? "ASC" : "DESC";

  const ORDER_MAP: Record<string, string> = {
    shiftDate: `b."shiftDate"`,
    entryTs: `b."entryTs"`,
    name: `b."name"`,
    machineNumber: `b."machineNumber"`,
    salesOrder: `b."salesOrder"`,
    lineCount: `b."lineCount"`,
    totalStitches: `b."totalStitches"`,
    totalPieces: `b."totalPieces"`,
    isVoided: `b."isVoided"`,
  };

  const orderExpr = ORDER_MAP[sortBy] ?? ORDER_MAP.entryTs;
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
        MIN(e.shift_date)::text AS "shiftDate",
        s.name AS "name",
        s.machine_number AS "machineNumber",
        COALESCE(s.sales_order_display, s.sales_order::text) AS "salesOrder",
        s.sales_order_base AS "salesOrderBase",
        s.sales_order_display AS "salesOrderDisplay",
        COUNT(e.id)::int AS "lineCount",
        COALESCE(SUM(e.stitches), 0)::bigint AS "totalStitches",
        COALESCE(SUM(e.pieces), 0)::bigint AS "totalPieces",
        s.notes AS "notes",
        COALESCE(s.is_voided, false) AS "isVoided",
        s.voided_at AS "voidedAt",
        s.voided_by AS "voidedBy",
        s.void_reason AS "voidReason"
      FROM public.embroidery_daily_submissions s
      LEFT JOIN public.embroidery_daily_entries e
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
  const clean = rows.map(({ totalCount: _tc, ...rest }: any) => rest) as EmbroiderySubmissionSummaryRow[];

  return { rows: clean, totalCount };
}