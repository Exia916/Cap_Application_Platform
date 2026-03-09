import { db } from "@/lib/db";

export type EmbroideryEntry = {
  id: string;
  entryTs: string;
  name: string;

  employeeNumber?: number;
  shift?: string;

  machineNumber: number | null;
  salesOrder: number | null;
  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  // ✅ NEW
  annex?: boolean;
  jobberSamplesRan?: number | null;

  notes: string | null;
};

export type AddEmbroideryEntryInput = {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  shift: string;

  machineNumber: number | null;
  salesOrder: number | null;
  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  // ✅ NEW (optional for legacy single-line insert)
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
  salesOrder: number | null;
  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  // ✅ NEW
  annex?: boolean;
  jobberSamplesRan?: number | null;

  notes: string | null;
};

/** ✅ Existing: single-line insert (kept for compatibility) */
export async function addEmbroideryEntry(input: AddEmbroideryEntryInput): Promise<{ id: string }> {
  // shift_date is GENERATED in Postgres — do NOT insert it.
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.embroidery_daily_entries (
      entry_ts,
      name,
      employee_number,
      shift,
      machine_number,
      sales_order,
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
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    )
    RETURNING id
    `,
    [
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.salesOrder,
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

export async function listEmbroideryEntriesByShiftDate(shiftDate: string): Promise<EmbroideryEntry[]> {
  const { rows } = await db.query<EmbroideryEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      embroidery_location AS "embroideryLocation",
      stitches,
      pieces,
      is_3d AS "is3d",
      is_knit AS "isKnit",
      detail_complete AS "detailComplete",
      annex,
      jobber_samples_ran AS "jobberSamplesRan",
      notes
    FROM public.embroidery_daily_entries
    WHERE shift_date = $1
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
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      embroidery_location AS "embroideryLocation",
      stitches,
      pieces,
      is_3d AS "is3d",
      is_knit AS "isKnit",
      detail_complete AS "detailComplete",
      annex,
      jobber_samples_ran AS "jobberSamplesRan",
      notes
    FROM public.embroidery_daily_entries
    WHERE employee_number = $1
      AND shift_date = $2
    ORDER BY entry_ts DESC
    `,
    [employeeNumber, shiftDate]
  );

  return rows;
}

export async function getEmbroideryEntryById(id: string): Promise<EmbroideryEntry | null> {
  const { rows } = await db.query<EmbroideryEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      embroidery_location AS "embroideryLocation",
      stitches,
      pieces,
      is_3d AS "is3d",
      is_knit AS "isKnit",
      detail_complete AS "detailComplete",
      annex,
      jobber_samples_ran AS "jobberSamplesRan",
      notes
    FROM public.embroidery_daily_entries
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function updateEmbroideryEntry(input: UpdateEmbroideryEntryInput): Promise<void> {
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
      detail_number = $8,
      embroidery_location = $9,
      stitches = $10,
      pieces = $11,
      is_3d = $12,
      is_knit = $13,
      detail_complete = $14,
      annex = $15,
      jobber_samples_ran = $16,
      notes = $17
    WHERE id = $1
    `,
    [
      input.id,
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.salesOrder,
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
   ✅ Submission support (header + lines)
   ============================================================ */

export type EmbroiderySubmission = {
  id: string;
  entryTs: string;
  name: string;
  employeeNumber: number;
  shift: string;
  machineNumber: number | null;
  salesOrder: number | null;

  // ✅ NEW
  annex: boolean;

  notes: string | null;
  createdAt: string;
  lineCount?: number;
};

export type SubmissionWithLines = {
  submission: EmbroiderySubmission;
  lines: EmbroideryEntry[];
};

export async function createEmbroiderySubmission(input: {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  shift: string;
  machineNumber: number | null;
  salesOrder: number | null;

  // ✅ NEW
  annex: boolean;

  notes: string | null;
}): Promise<{ id: string }> {
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.embroidery_daily_submissions (
      entry_ts, name, employee_number, shift, machine_number, sales_order, annex, notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
    `,
    [
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.salesOrder,
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
  salesOrder: number | null;

  // ✅ NEW: copied to each line row
  annex: boolean;

  lines: Array<{
    detailNumber: number | null;
    embroideryLocation: string | null;
    stitches: number | null;
    pieces: number | null;

    // ✅ NEW
    jobberSamplesRan: number | null;

    is3d: boolean;
    isKnit: boolean;
    detailComplete: boolean;
    notes: string | null; // per-line notes
  }>;
}): Promise<Array<{ id: string }>> {
  if (input.lines.length === 0) return [];

  const values: any[] = [];
  const tuples: string[] = [];

  // ✅ Now 17 columns per line insert
  input.lines.forEach((l, i) => {
    const base = i * 17;
    tuples.push(
      `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16},$${base + 17})`
    );

    values.push(
      input.submissionId,
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.salesOrder,
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
  salesOrder: number;
}): Promise<EmbroiderySubmission[]> {
  const { rows } = await db.query<EmbroiderySubmission>(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.name,
      s.employee_number AS "employeeNumber",
      s.shift,
      s.machine_number AS "machineNumber",
      s.sales_order AS "salesOrder",
      s.annex AS "annex",
      s.notes,
      s.created_at AS "createdAt",
      COUNT(e.id)::int AS "lineCount"
    FROM public.embroidery_daily_submissions s
    JOIN public.embroidery_daily_entries e
      ON e.submission_id = s.id
    WHERE s.employee_number = $1
      AND s.sales_order = $2
    GROUP BY s.id
    ORDER BY s.entry_ts DESC
    `,
    [input.employeeNumber, input.salesOrder]
  );

  return rows;
}

export async function getEmbroiderySubmissionWithLines(submissionId: string): Promise<SubmissionWithLines | null> {
  const sub = await db.query<EmbroiderySubmission>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      sales_order AS "salesOrder",
      annex,
      notes,
      created_at AS "createdAt"
    FROM public.embroidery_daily_submissions
    WHERE id = $1
    LIMIT 1
    `,
    [submissionId]
  );

  const submission = sub.rows[0];
  if (!submission) return null;

  const linesRes = await db.query<EmbroideryEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      embroidery_location AS "embroideryLocation",
      stitches,
      pieces,
      is_3d AS "is3d",
      is_knit AS "isKnit",
      detail_complete AS "detailComplete",
      annex,
      jobber_samples_ran AS "jobberSamplesRan",
      notes
    FROM public.embroidery_daily_entries
    WHERE submission_id = $1
    ORDER BY id ASC
    `,
    [submissionId]
  );

  return { submission, lines: linesRes.rows };
}

export async function replaceEmbroiderySubmission(input: {
  submissionId: string;
  entryTs: Date;
  machineNumber: number | null;

  // ✅ NEW
  annex: boolean;

  notes: string | null;

  lines: Array<{
    detailNumber: number | null;
    embroideryLocation: string | null;
    stitches: number | null;
    pieces: number | null;

    // ✅ NEW
    jobberSamplesRan: number | null;

    is3d: boolean;
    isKnit: boolean;
    detailComplete: boolean;
    notes: string | null;
  }>;
}): Promise<{ count: number }> {
  await db.query("BEGIN");
  try {
    // Update header
    await db.query(
      `
      UPDATE public.embroidery_daily_submissions
      SET entry_ts = $2, machine_number = $3, annex = $4, notes = $5
      WHERE id = $1
      `,
      [input.submissionId, input.entryTs, input.machineNumber, !!input.annex, input.notes]
    );

    // Load immutable header bits needed for line inserts
    const { rows: subRows } = await db.query<{
      name: string;
      employeeNumber: number;
      shift: string;
      salesOrder: number | null;
    }>(
      `
      SELECT
        name,
        employee_number AS "employeeNumber",
        shift,
        sales_order AS "salesOrder"
      FROM public.embroidery_daily_submissions
      WHERE id = $1
      LIMIT 1
      `,
      [input.submissionId]
    );

    const s = subRows[0];
    if (!s) throw new Error("Submission not found.");

    // Replace lines
    await db.query(`DELETE FROM public.embroidery_daily_entries WHERE submission_id = $1`, [input.submissionId]);

    await addEmbroideryEntriesBulk({
      submissionId: input.submissionId,
      entryTs: input.entryTs,
      name: s.name,
      employeeNumber: s.employeeNumber,
      shift: s.shift,
      machineNumber: input.machineNumber,
      salesOrder: s.salesOrder,
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