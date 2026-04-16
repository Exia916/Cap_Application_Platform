import { buildVoidedWhereClause, joinWhere, pushWhere } from "./_shared/repoFilters";
import { resolveVoidMode, StandardRepoOptions } from "./_shared/repoTypes";
import { voidRecord, unvoidRecord } from "./_shared/voiding";

export type QueryFn = <T = any>(
  sql: string,
  params?: any[]
) => Promise<{ rows: T[]; rowCount: number }>;

export type SearchMethod = "match_any" | "match_all";

export interface DesignWorkflowRequest {
  id: string;
  request_number: string;
  sales_order_number: string | null;
  sales_order_base: string | null;
  po_number: string | null;
  tape_name: string | null;
  date_request_created: string | null;
  due_date: string | null;
  customer_name: string | null;
  customer_code: string | null;
  bin_code: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  digitizer_user_id: string | null;
  digitizer_name: string | null;
  designer_user_id: string | null;
  designer_name: string | null;
  status_id: number;
  status_code?: string;
  status_label?: string;
  instructions: string | null;
  additional_instructions: string | null;
  colorways_text: string | null;
  tape_number: string | null;
  rush: boolean;
  style_code: string | null;
  sample_so_number: string | null;
  stitch_count: number | null;
  art_proof: boolean;
  is_voided: boolean;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface DesignWorkflowStatusHistory {
  id: number;
  request_id: string;
  status_id: number;
  status_code?: string;
  status_label?: string;
  changed_at: string;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
}

export interface SavedSearchRow {
  id: number;
  user_id: string;
  name: string;
  search_method: SearchMethod;
  search_criteria: any;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  is_owner?: boolean;
}

export interface ListRequestOptions extends StandardRepoOptions {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
  searchMethod?: SearchMethod;
  filters?: {
    salesOrderNumbers?: string[];
    poNumbers?: string[];
    tapeNames?: string[];
    createdByNames?: string[];
    instructionsTerms?: string[];
    tapeNumbers?: string[];
    sampleSoNumbers?: string[];
    stitchCounts?: string[];

    customerCodes?: string[];
    binCodes?: string[];
    digitizerUserIds?: string[];
    designerUserIds?: string[];
    statusIds?: number[];
    styleCodes?: string[];

    rush?: boolean | null;
    artProof?: boolean | null;

    dateRequestCreatedFrom?: string;
    dateRequestCreatedTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;

    // legacy compatibility
    statusId?: number;
    digitizerUserId?: string;
    designerUserId?: string;
    customerCode?: string;
    customerName?: string;
    salesOrderNumber?: string;
    binCode?: string;
    search?: string;
  };
}

export interface PagedDesignWorkflowResult {
  rows: DesignWorkflowRequest[];
  totalCount: number;
  page: number;
  pageSize: number;
}

function normalizeStringArray(values?: string[] | null): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeNumberArray(values?: number[] | null): number[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
    )
  );
}

function likeAnyClause(
  expressions: string[],
  values: string[],
  params: any[],
  startIndex: number
): { clause: string | null; nextIndex: number } {
  const clean = normalizeStringArray(values);
  if (clean.length === 0) {
    return { clause: null, nextIndex: startIndex };
  }

  let idx = startIndex;
  const parts: string[] = [];

  for (const value of clean) {
    const paramRef = `$${idx++}`;
    params.push(`%${value}%`);
    const exprSql = expressions.map((expr) => `${expr} ILIKE ${paramRef}`).join(" OR ");
    parts.push(`(${exprSql})`);
  }

  return {
    clause: `(${parts.join(" OR ")})`,
    nextIndex: idx,
  };
}

function equalsAnyClause(
  expression: string,
  values: string[],
  params: any[],
  startIndex: number
): { clause: string | null; nextIndex: number } {
  const clean = normalizeStringArray(values);
  if (clean.length === 0) {
    return { clause: null, nextIndex: startIndex };
  }

  const refs: string[] = [];
  let idx = startIndex;

  for (const value of clean) {
    refs.push(`$${idx++}`);
    params.push(value);
  }

  return {
    clause: `${expression} IN (${refs.join(", ")})`,
    nextIndex: idx,
  };
}

function numberAnyClause(
  expression: string,
  values: number[],
  params: any[],
  startIndex: number
): { clause: string | null; nextIndex: number } {
  const clean = normalizeNumberArray(values);
  if (clean.length === 0) {
    return { clause: null, nextIndex: startIndex };
  }

  const refs: string[] = [];
  let idx = startIndex;

  for (const value of clean) {
    refs.push(`$${idx++}`);
    params.push(value);
  }

  return {
    clause: `${expression} IN (${refs.join(", ")})`,
    nextIndex: idx,
  };
}

function boolClause(
  expression: string,
  value: boolean | null | undefined,
  params: any[],
  startIndex: number
): { clause: string | null; nextIndex: number } {
  if (typeof value !== "boolean") {
    return { clause: null, nextIndex: startIndex };
  }

  params.push(value);
  return {
    clause: `${expression} = $${startIndex}`,
    nextIndex: startIndex + 1,
  };
}

function dateRangeClause(
  expression: string,
  fromValue: string | undefined,
  toValue: string | undefined,
  params: any[],
  startIndex: number
): { clauses: string[]; nextIndex: number } {
  const clauses: string[] = [];
  let idx = startIndex;

  if (String(fromValue ?? "").trim()) {
    clauses.push(`${expression} >= $${idx++}`);
    params.push(fromValue);
  }

  if (String(toValue ?? "").trim()) {
    clauses.push(`${expression} <= $${idx++}`);
    params.push(toValue);
  }

  return { clauses, nextIndex: idx };
}

function getOrderBy(sortField?: string, sortDir?: "asc" | "desc") {
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  const map: Record<string, string> = {
    requestNumber: `dwr.request_number ${dir}`,
    salesOrderNumber: `COALESCE(dwr.sales_order_number, dwr.sales_order_base, '') ${dir}`,
    poNumber: `COALESCE(dwr.po_number, '') ${dir}`,
    tapeName: `COALESCE(dwr.tape_name, '') ${dir}`,
    dateRequestCreated: `dwr.date_request_created ${dir}`,
    dueDate: `dwr.due_date ${dir}`,
    customerName: `COALESCE(dwr.customer_name, '') ${dir}`,
    binCode: `COALESCE(dwr.bin_code, '') ${dir}`,
    createdByName: `COALESCE(dwr.created_by_name, '') ${dir}`,
    digitizerName: `COALESCE(dwr.digitizer_name, '') ${dir}`,
    designerName: `COALESCE(dwr.designer_name, '') ${dir}`,
    statusId: `dwr.status_id ${dir}`,
    tapeNumber: `COALESCE(dwr.tape_number, '') ${dir}`,
    rush: `dwr.rush ${dir}`,
    styleCode: `COALESCE(dwr.style_code, '') ${dir}`,
    sampleSoNumber: `COALESCE(dwr.sample_so_number, '') ${dir}`,
    stitchCount: `dwr.stitch_count ${dir}`,
    artProof: `dwr.art_proof ${dir}`,
    createdAt: `dwr.created_at ${dir}`,
  };

  return map[sortField || ""] ?? `dwr.created_at DESC, dwr.request_number DESC`;
}

function buildSearchFieldClauses(
  filters: NonNullable<ListRequestOptions["filters"]>,
  params: any[],
  startIndex: number
): { clauses: string[]; nextIndex: number } {
  const clauses: string[] = [];
  let idx = startIndex;

  const mergedSalesOrders = normalizeStringArray([
    ...(filters.salesOrderNumbers ?? []),
    filters.salesOrderNumber ?? "",
  ]);

  const mergedPoNumbers = normalizeStringArray(filters.poNumbers ?? []);
  const mergedTapeNames = normalizeStringArray(filters.tapeNames ?? []);
  const mergedCreatedBy = normalizeStringArray(filters.createdByNames ?? []);
  const mergedInstructions = normalizeStringArray(filters.instructionsTerms ?? []);
  const mergedTapeNumbers = normalizeStringArray(filters.tapeNumbers ?? []);
  const mergedSampleSOs = normalizeStringArray(filters.sampleSoNumbers ?? []);
  const mergedStitchCounts = normalizeStringArray(filters.stitchCounts ?? []);

  const mergedCustomerCodes = normalizeStringArray([
    ...(filters.customerCodes ?? []),
    filters.customerCode ?? "",
  ]);

  const mergedBinCodes = normalizeStringArray([
    ...(filters.binCodes ?? []),
    filters.binCode ?? "",
  ]);

  const mergedDigitizerIds = normalizeStringArray([
    ...(filters.digitizerUserIds ?? []),
    filters.digitizerUserId ?? "",
  ]);

  const mergedDesignerIds = normalizeStringArray([
    ...(filters.designerUserIds ?? []),
    filters.designerUserId ?? "",
  ]);

  const mergedStatusIds = normalizeNumberArray([
    ...(filters.statusIds ?? []),
    ...(filters.statusId ? [filters.statusId] : []),
  ]);

  const mergedStyleCodes = normalizeStringArray(filters.styleCodes ?? []);

  const salesOrderClause = likeAnyClause(
    [
      `COALESCE(dwr.sales_order_number, '')`,
      `COALESCE(dwr.sales_order_base, '')`,
      `COALESCE(dwr.request_number, '')`,
    ],
    mergedSalesOrders,
    params,
    idx
  );
  if (salesOrderClause.clause) clauses.push(salesOrderClause.clause);
  idx = salesOrderClause.nextIndex;

  const poClause = likeAnyClause(
    [`COALESCE(dwr.po_number, '')`],
    mergedPoNumbers,
    params,
    idx
  );
  if (poClause.clause) clauses.push(poClause.clause);
  idx = poClause.nextIndex;

  const tapeNameClause = likeAnyClause(
    [`COALESCE(dwr.tape_name, '')`],
    mergedTapeNames,
    params,
    idx
  );
  if (tapeNameClause.clause) clauses.push(tapeNameClause.clause);
  idx = tapeNameClause.nextIndex;

  const customerClause = likeAnyClause(
    [`COALESCE(dwr.customer_code, '')`, `COALESCE(dwr.customer_name, '')`],
    mergedCustomerCodes,
    params,
    idx
  );
  if (customerClause.clause) clauses.push(customerClause.clause);
  idx = customerClause.nextIndex;

  const binClause = likeAnyClause(
    [`COALESCE(dwr.bin_code, '')`],
    mergedBinCodes,
    params,
    idx
  );
  if (binClause.clause) clauses.push(binClause.clause);
  idx = binClause.nextIndex;

  const createdByClause = likeAnyClause(
    [`COALESCE(dwr.created_by_name, '')`],
    mergedCreatedBy,
    params,
    idx
  );
  if (createdByClause.clause) clauses.push(createdByClause.clause);
  idx = createdByClause.nextIndex;

  const digitizerClause = equalsAnyClause(
    `COALESCE(dwr.digitizer_user_id, '')`,
    mergedDigitizerIds,
    params,
    idx
  );
  if (digitizerClause.clause) clauses.push(digitizerClause.clause);
  idx = digitizerClause.nextIndex;

  const designerClause = equalsAnyClause(
    `COALESCE(dwr.designer_user_id, '')`,
    mergedDesignerIds,
    params,
    idx
  );
  if (designerClause.clause) clauses.push(designerClause.clause);
  idx = designerClause.nextIndex;

  const statusClause = numberAnyClause(
    `dwr.status_id`,
    mergedStatusIds,
    params,
    idx
  );
  if (statusClause.clause) clauses.push(statusClause.clause);
  idx = statusClause.nextIndex;

  const instructionsClause = likeAnyClause(
    [`COALESCE(dwr.instructions, '')`],
    mergedInstructions,
    params,
    idx
  );
  if (instructionsClause.clause) clauses.push(instructionsClause.clause);
  idx = instructionsClause.nextIndex;

  const tapeNumberClause = likeAnyClause(
    [`COALESCE(dwr.tape_number, '')`],
    mergedTapeNumbers,
    params,
    idx
  );
  if (tapeNumberClause.clause) clauses.push(tapeNumberClause.clause);
  idx = tapeNumberClause.nextIndex;

  const styleClause = equalsAnyClause(
    `COALESCE(dwr.style_code, '')`,
    mergedStyleCodes,
    params,
    idx
  );
  if (styleClause.clause) clauses.push(styleClause.clause);
  idx = styleClause.nextIndex;

  const sampleSOClause = likeAnyClause(
    [`COALESCE(dwr.sample_so_number, '')`],
    mergedSampleSOs,
    params,
    idx
  );
  if (sampleSOClause.clause) clauses.push(sampleSOClause.clause);
  idx = sampleSOClause.nextIndex;

  const stitchCountClause = likeAnyClause(
    [`COALESCE(CAST(dwr.stitch_count AS text), '')`],
    mergedStitchCounts,
    params,
    idx
  );
  if (stitchCountClause.clause) clauses.push(stitchCountClause.clause);
  idx = stitchCountClause.nextIndex;

  const rushClause = boolClause(`dwr.rush`, filters.rush, params, idx);
  if (rushClause.clause) clauses.push(rushClause.clause);
  idx = rushClause.nextIndex;

  const artProofClause = boolClause(`dwr.art_proof`, filters.artProof, params, idx);
  if (artProofClause.clause) clauses.push(artProofClause.clause);
  idx = artProofClause.nextIndex;

  const createdDateRange = dateRangeClause(
    `DATE(dwr.date_request_created)`,
    filters.dateRequestCreatedFrom,
    filters.dateRequestCreatedTo,
    params,
    idx
  );
  clauses.push(...createdDateRange.clauses);
  idx = createdDateRange.nextIndex;

  const dueDateRange = dateRangeClause(
    `dwr.due_date`,
    filters.dueDateFrom,
    filters.dueDateTo,
    params,
    idx
  );
  clauses.push(...dueDateRange.clauses);
  idx = dueDateRange.nextIndex;

  // Legacy fallback generic search
  if (String(filters.search ?? "").trim()) {
    const generic = likeAnyClause(
      [
        `COALESCE(dwr.request_number, '')`,
        `COALESCE(dwr.sales_order_number, '')`,
        `COALESCE(dwr.po_number, '')`,
        `COALESCE(dwr.tape_name, '')`,
        `COALESCE(dwr.instructions, '')`,
      ],
      [String(filters.search)],
      params,
      idx
    );
    if (generic.clause) clauses.push(generic.clause);
    idx = generic.nextIndex;
  }

  // Legacy customerName fallback
  if (String(filters.customerName ?? "").trim()) {
    const customerNameClause = likeAnyClause(
      [`COALESCE(dwr.customer_name, '')`],
      [String(filters.customerName)],
      params,
      idx
    );
    if (customerNameClause.clause) clauses.push(customerNameClause.clause);
    idx = customerNameClause.nextIndex;
  }

  return { clauses, nextIndex: idx };
}

export async function listRequests(
  query: QueryFn,
  opts: ListRequestOptions = {}
): Promise<PagedDesignWorkflowResult> {
  const page = opts.page && opts.page > 0 ? opts.page : 1;
  const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : 25;
  const offset = (page - 1) * pageSize;
  const searchMethod: SearchMethod = opts.searchMethod === "match_any" ? "match_any" : "match_all";

  const where: string[] = [];
  const params: any[] = [];
  let idx = 1;

  const voidMode = resolveVoidMode(opts);
  pushWhere(where, buildVoidedWhereClause("dwr", voidMode));

  const filters = opts.filters ?? {};
  const fieldClausesResult = buildSearchFieldClauses(filters, params, idx);
  idx = fieldClausesResult.nextIndex;

  if (fieldClausesResult.clauses.length > 0) {
    const joiner = searchMethod === "match_any" ? " OR " : " AND ";
    pushWhere(where, `(${fieldClausesResult.clauses.join(joiner)})`);
  }

  const whereClause = joinWhere(where);
  const orderBy = getOrderBy(opts.sortField, opts.sortDir);

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM public.design_workflow_requests dwr
    ${whereClause}
  `;

  const dataSql = `
    SELECT
      dwr.*,
      s.code AS status_code,
      s.label AS status_label
    FROM public.design_workflow_requests dwr
    JOIN public.design_workflow_statuses s
      ON s.id = dwr.status_id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const countRes = await query<{ total: number }>(countSql, params);
  const rowsRes = await query<DesignWorkflowRequest>(dataSql, [...params, pageSize, offset]);

  return {
    rows: rowsRes.rows,
    totalCount: Number(countRes.rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getRequestById(
  query: QueryFn,
  id: string,
  opts: StandardRepoOptions = {}
) {
  const voidMode = resolveVoidMode(opts);
  const sql = `
    SELECT dwr.*, s.code AS status_code, s.label AS status_label
    FROM public.design_workflow_requests dwr
    JOIN public.design_workflow_statuses s ON s.id = dwr.status_id
    WHERE dwr.id = $1
      AND ${buildVoidedWhereClause("dwr", voidMode)}
  `;
  const { rows } = await query<DesignWorkflowRequest>(sql, [id]);
  return rows[0] || null;
}

export interface CreateRequestInput {
  id: string;
  request_number: string;
  sales_order_number?: string | null;
  sales_order_base?: string | null;
  po_number?: string | null;
  tape_name?: string | null;
  date_request_created?: string | null;
  due_date?: string | null;
  customer_name?: string | null;
  customer_code?: string | null;
  bin_code?: string | null;
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  digitizer_user_id?: string | null;
  digitizer_name?: string | null;
  designer_user_id?: string | null;
  designer_name?: string | null;
  status_id: number;
  instructions?: string | null;
  additional_instructions?: string | null;
  colorways_text?: string | null;
  tape_number?: string | null;
  rush?: boolean;
  style_code?: string | null;
  sample_so_number?: string | null;
  stitch_count?: number | null;
  art_proof?: boolean;
  created_by?: string | null;
}

export async function createRequest(query: QueryFn, input: CreateRequestInput) {
  await query("BEGIN");
  try {
    const cols: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        cols.push(key);
        placeholders.push(`$${idx++}`);
        values.push(value);
      }
    }

    if (!("rush" in input)) {
      cols.push("rush");
      placeholders.push(`$${idx++}`);
      values.push(false);
    }

    if (!("art_proof" in input)) {
      cols.push("art_proof");
      placeholders.push(`$${idx++}`);
      values.push(false);
    }

    const insertSql = `
      INSERT INTO public.design_workflow_requests (${cols.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    `;
    const { rows } = await query<DesignWorkflowRequest>(insertSql, values);
    const request = rows[0];

    await query(
      `
      INSERT INTO public.design_workflow_status_history
        (request_id, status_id, changed_by_user_id, changed_by_name)
      VALUES ($1, $2, $3, $4)
      `,
      [
        request.id,
        request.status_id,
        input.created_by_user_id ?? null,
        input.created_by_name ?? null,
      ]
    );

    await query("COMMIT");
    return request;
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

export interface UpdateRequestInput {
  requestId: string;
  data: Partial<{
    request_number: string;
    sales_order_number: string | null;
    sales_order_base: string | null;
    po_number: string | null;
    tape_name: string | null;
    date_request_created: string | null;
    due_date: string | null;
    customer_name: string | null;
    customer_code: string | null;
    bin_code: string | null;
    created_by_user_id: string | null;
    created_by_name: string | null;
    digitizer_user_id: string | null;
    digitizer_name: string | null;
    designer_user_id: string | null;
    designer_name: string | null;
    status_id: number;
    instructions: string | null;
    additional_instructions: string | null;
    colorways_text: string | null;
    tape_number: string | null;
    rush: boolean;
    style_code: string | null;
    sample_so_number: string | null;
    stitch_count: number | null;
    art_proof: boolean;
  }>;
  updatedBy: string | null;
  updatedByUserId?: string | null;
}

export async function updateRequest(query: QueryFn, opts: UpdateRequestInput) {
  const existing = await getRequestById(query, opts.requestId, { includeVoided: true });
  if (!existing) throw new Error("Request not found");
  if (existing.is_voided) throw new Error("Cannot edit a voided request");

  const nextStatusId =
    typeof opts.data.status_id === "number" ? opts.data.status_id : existing.status_id;

  await query("BEGIN");
  try {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(opts.data)) {
      sets.push(`${key} = $${idx++}`);
      params.push(value);
    }

    sets.push(`updated_at = NOW()`);
    if (opts.updatedBy) {
      sets.push(`updated_by = $${idx++}`);
      params.push(opts.updatedBy);
    }

    const sql = `
      UPDATE public.design_workflow_requests
      SET ${sets.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;
    params.push(opts.requestId);

    const { rows } = await query<DesignWorkflowRequest>(sql, params);
    const updated = rows[0] || null;

    if (updated && nextStatusId !== existing.status_id) {
      await query(
        `
        INSERT INTO public.design_workflow_status_history
          (request_id, status_id, changed_by_user_id, changed_by_name)
        VALUES ($1, $2, $3, $4)
        `,
        [
          opts.requestId,
          nextStatusId,
          opts.updatedByUserId ?? null,
          opts.updatedBy ?? null,
        ]
      );
    }

    await query("COMMIT");
    return updated;
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

export async function changeStatus(
  query: QueryFn,
  params: {
    requestId: string;
    newStatusId: number;
    changedByUserId?: string | null;
    changedByName?: string | null;
  }
) {
  await query("BEGIN");
  try {
    const updateSql = `
      UPDATE public.design_workflow_requests
      SET status_id = $2,
          updated_at = NOW(),
          updated_by = $3
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      RETURNING *
    `;
    const { rows: updated } = await query<DesignWorkflowRequest>(updateSql, [
      params.requestId,
      params.newStatusId,
      params.changedByName ?? null,
    ]);

    if (updated.length === 0) {
      throw new Error("Request not found or is voided");
    }

    await query(
      `
      INSERT INTO public.design_workflow_status_history
        (request_id, status_id, changed_by_user_id, changed_by_name)
      VALUES ($1, $2, $3, $4)
      `,
      [
        params.requestId,
        params.newStatusId,
        params.changedByUserId ?? null,
        params.changedByName ?? null,
      ]
    );

    await query("COMMIT");
    return updated[0];
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

export async function listStatusHistory(query: QueryFn, requestId: string) {
  const sql = `
    SELECT h.*, s.code AS status_code, s.label AS status_label
    FROM public.design_workflow_status_history h
    JOIN public.design_workflow_statuses s ON s.id = h.status_id
    WHERE h.request_id = $1
    ORDER BY h.changed_at ASC
  `;
  const { rows } = await query<DesignWorkflowStatusHistory>(sql, [requestId]);
  return rows;
}

export async function saveUserPreferences(query: QueryFn, userId: string, prefs: any) {
  const sql = `
    INSERT INTO public.design_workflow_user_preferences (user_id, last_search)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE
    SET last_search = EXCLUDED.last_search,
        updated_at = NOW()
    RETURNING *
  `;
  const { rows } = await query(sql, [userId, prefs]);
  return rows[0] || null;
}

export async function getUserPreferences(query: QueryFn, userId: string) {
  const sql = `
    SELECT *
    FROM public.design_workflow_user_preferences
    WHERE user_id = $1
  `;
  const { rows } = await query(sql, [userId]);
  return rows[0] || null;
}

export async function listSavedSearches(query: QueryFn, userId: string) {
  const sql = `
    SELECT
      id,
      user_id,
      name,
      search_method,
      search_criteria,
      is_shared,
      created_at,
      updated_at,
      (user_id = $1) AS is_owner
    FROM public.design_workflow_saved_searches
    WHERE user_id = $1
       OR is_shared = true
    ORDER BY
      CASE WHEN user_id = $1 THEN 0 ELSE 1 END,
      name ASC
  `;
  const { rows } = await query<SavedSearchRow>(sql, [userId]);
  return rows;
}

export async function createSavedSearch(
  query: QueryFn,
  userId: string,
  name: string,
  searchMethod: SearchMethod,
  criteria: any,
  isShared: boolean
) {
  const sql = `
    INSERT INTO public.design_workflow_saved_searches
      (user_id, name, search_method, search_criteria, is_shared)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, name) DO UPDATE
    SET search_method = EXCLUDED.search_method,
        search_criteria = EXCLUDED.search_criteria,
        is_shared = EXCLUDED.is_shared,
        updated_at = NOW()
    RETURNING *
  `;
  const { rows } = await query(sql, [userId, name, searchMethod, criteria, isShared]);
  return rows[0] || null;
}

export async function updateSavedSearch(
  query: QueryFn,
  id: number,
  userId: string,
  name: string,
  searchMethod: SearchMethod,
  criteria: any,
  isShared: boolean
) {
  const sql = `
    UPDATE public.design_workflow_saved_searches
    SET name = $3,
        search_method = $4,
        search_criteria = $5,
        is_shared = $6,
        updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;
  const { rows } = await query(sql, [id, userId, name, searchMethod, criteria, isShared]);
  return rows[0] || null;
}

export async function deleteSavedSearch(query: QueryFn, id: number, userId: string) {
  const sql = `
    DELETE FROM public.design_workflow_saved_searches
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;
  const { rows } = await query(sql, [id, userId]);
  return rows[0] || null;
}

export async function voidRequest(
  query: QueryFn,
  params: { requestId: string; userName: string; reason?: string | null }
) {
  const { rows } = await voidRecord(query, {
    tableName: "design_workflow_requests",
    idColumn: "id",
    idValue: params.requestId,
    userName: params.userName,
    reason: params.reason ?? null,
  });
  return rows[0] || null;
}

export async function unvoidRequest(query: QueryFn, params: { requestId: string }) {
  const { rows } = await unvoidRecord(query, {
    tableName: "design_workflow_requests",
    idColumn: "id",
    idValue: params.requestId,
  });
  return rows[0] || null;
}