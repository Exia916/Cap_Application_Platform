import { db } from "@/lib/db";

export type SampleEmbroideryEntry = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number | null;
  salesOrder: string | null;
  detailCount: number;
  quantity: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AddSampleEmbroideryEntryInput = {
  entryTs?: Date;
  name: string;
  employeeNumber: number;
  salesOrder: number | null;
  detailCount: number;
  quantity: number;
  notes: string | null;
};

export type UpdateSampleEmbroideryEntryInput = {
  id: string;
  salesOrder: number | null;
  detailCount: number;
  quantity: number;
  notes: string | null;
};

export type ListSampleEmbroideryEntriesArgs = {
  entryDateFrom: string;
  entryDateTo: string;
  employeeNumber?: number;
  usernameNameFallback?: string;
  role?: string;
  name?: string;
  salesOrderStartsWith?: string;
  notes?: string;
  detailCount?: string;
  quantity?: string;
  sortBy?:
    | "entryTs"
    | "entryDate"
    | "name"
    | "salesOrder"
    | "detailCount"
    | "quantity";
  sortDir?: "asc" | "desc";
  limit: number;
  offset: number;
};

export async function addSampleEmbroideryEntry(
  input: AddSampleEmbroideryEntryInput
): Promise<{ id: string }> {
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.sample_embroidery_entries (
      entry_ts,
      name,
      employee_number,
      sales_order,
      detail_count,
      quantity,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id
    `,
    [
      input.entryTs ?? new Date(),
      input.name,
      input.employeeNumber,
      input.salesOrder,
      input.detailCount,
      input.quantity,
      input.notes,
    ]
  );

  return rows[0];
}

export async function getSampleEmbroideryEntryById(
  id: string
): Promise<SampleEmbroideryEntry | null> {
  const { rows } = await db.query<SampleEmbroideryEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      entry_date::text AS "entryDate",
      name,
      employee_number AS "employeeNumber",
      sales_order::text AS "salesOrder",
      detail_count AS "detailCount",
      quantity,
      notes,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM public.sample_embroidery_entries
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function updateSampleEmbroideryEntry(
  input: UpdateSampleEmbroideryEntryInput
): Promise<void> {
  await db.query(
    `
    UPDATE public.sample_embroidery_entries
    SET
      sales_order = $2,
      detail_count = $3,
      quantity = $4,
      notes = $5
    WHERE id = $1
    `,
    [
      input.id,
      input.salesOrder,
      input.detailCount,
      input.quantity,
      input.notes,
    ]
  );
}

export async function updateSampleEmbroideryEntryOwnedByUser(input: {
  id: string;
  salesOrder: number | null;
  detailCount: number;
  quantity: number;
  notes: string | null;
  name: string;
  employeeNumber: number | null;
}): Promise<number> {
  const result = await db.query(
    `
    UPDATE public.sample_embroidery_entries
    SET
      sales_order = $1,
      detail_count = $2,
      quantity = $3,
      notes = $4
    WHERE id = $5
      AND name = $6
      AND employee_number = $7
    `,
    [
      input.salesOrder,
      input.detailCount,
      input.quantity,
      input.notes,
      input.id,
      input.name,
      input.employeeNumber,
    ]
  );

  return result.rowCount ?? 0;
}

export async function listSampleEmbroideryEntriesRange(
  input: ListSampleEmbroideryEntriesArgs
): Promise<{ rows: SampleEmbroideryEntry[]; totalCount: number }> {
  const params: any[] = [input.entryDateFrom, input.entryDateTo];
  let where = `s.entry_date BETWEEN $1::date AND $2::date`;

  const roleUpper = String(input.role || "").toUpperCase();
  if (roleUpper !== "ADMIN") {
    if (input.employeeNumber != null) {
      params.push(input.employeeNumber);
      where += ` AND s.employee_number = $${params.length}::int`;
    } else if (input.usernameNameFallback?.trim()) {
      params.push(input.usernameNameFallback.trim());
      where += ` AND s.name = $${params.length}::text`;
    }
  }

  if (input.name?.trim()) {
    params.push(`%${input.name.trim()}%`);
    where += ` AND s.name ILIKE $${params.length}`;
  }

  if (input.salesOrderStartsWith?.trim()) {
    params.push(`${input.salesOrderStartsWith.trim()}%`);
    where += ` AND COALESCE(s.sales_order::text,'') LIKE $${params.length}`;
  }

  if (input.notes?.trim()) {
    params.push(`%${input.notes.trim()}%`);
    where += ` AND COALESCE(s.notes,'') ILIKE $${params.length}`;
  }

  if (input.detailCount?.trim()) {
    params.push(`${input.detailCount.trim()}%`);
    where += ` AND COALESCE(s.detail_count::text,'') LIKE $${params.length}`;
  }

  if (input.quantity?.trim()) {
    params.push(`${input.quantity.trim()}%`);
    where += ` AND COALESCE(s.quantity::text,'') LIKE $${params.length}`;
  }

  const sortBy = input.sortBy ?? "entryTs";
  const sortDir = input.sortDir === "asc" ? "ASC" : "DESC";

  const ORDER_MAP: Record<string, string> = {
    entryTs: `s.entry_ts`,
    entryDate: `s.entry_date`,
    name: `s.name`,
    salesOrder: `s.sales_order`,
    detailCount: `s.detail_count`,
    quantity: `s.quantity`,
  };

  const orderExpr = ORDER_MAP[sortBy] ?? ORDER_MAP.entryTs;
  const orderBySql = `${orderExpr} ${sortDir}, s.id DESC`;

  const countRes = await db.query<{ total: number }>(
    `
    SELECT COUNT(*)::int AS total
    FROM public.sample_embroidery_entries s
    WHERE ${where}
    `,
    params
  );

  const totalCount = countRes.rows[0]?.total ?? 0;

  params.push(input.limit);
  const limitParam = `$${params.length}`;
  params.push(input.offset);
  const offsetParam = `$${params.length}`;

  const { rows } = await db.query<SampleEmbroideryEntry>(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.entry_date::text AS "entryDate",
      s.name,
      s.employee_number AS "employeeNumber",
      s.sales_order::text AS "salesOrder",
      s.detail_count AS "detailCount",
      s.quantity,
      s.notes,
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt"
    FROM public.sample_embroidery_entries s
    WHERE ${where}
    ORDER BY ${orderBySql}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
    `,
    params
  );

  return { rows, totalCount };
}