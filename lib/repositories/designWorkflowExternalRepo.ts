import type {
  ExternalPartnerContext,
  QueryFn,
} from "@/lib/repositories/externalPartnerRepo";
import { EXTERNAL_MODULE_KEYS, EXTERNAL_PARTNER_TYPES } from "@/lib/external-access/constants";

export type ExternalWorkflowSortField =
  | "requestNumber"
  | "statusLabel"
  | "tapeNumber"
  | "tapeName"
  | "customerName"
  | "styleCode"
  | "dueDate"
  | "designerName"
  | "digitizerName"
  | "rush"
  | "createdAt";

export type ExternalWorkflowListOptions = {
  page?: number;
  pageSize?: number;
  sortField?: string | null;
  sortDir?: "asc" | "desc" | null;
  search?: string | null;
  statusCode?: string | null;
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
};

export type ExternalWorkflowRow = {
  id: string;
  requestNumber: string;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  poNumber: string | null;
  tapeName: string | null;
  dateRequestCreated: string | null;
  dueDate: string | null;
  customerName: string | null;
  customerCode: string | null;
  binCode: string | null;
  digitizerUserId: string | null;
  digitizerName: string | null;
  designerUserId: string | null;
  designerName: string | null;
  statusId: number;
  statusCode: string;
  statusLabel: string;
  instructions: string | null;
  additionalInstructions: string | null;
  colorwaysText: string | null;
  tapeNumber: string | null;
  rush: boolean;
  styleCode: string | null;
  sampleSoNumber: string | null;
  stitchCount: number | null;
  artProof: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  externalAssignmentField: "designer" | "digitizer";
  externalVisibilityMode: string;
  externalCompleteToStatusCode: string | null;
};

export type ExternalWorkflowPagedResult = {
  rows: ExternalWorkflowRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type ExternalAssignableWorkflowUser = {
  id: string;
  username: string | null;
  displayName: string;
  email: string | null;
  employeeNumber: number | null;
  role: string | null;
  department: string | null;
  externalRole: string;
};

export type ExternalWorkflowAssignmentField = "designer" | "digitizer";

export type ExternalWorkflowActor = {
  userId: string | null;
  actorName: string | null;
};

class ExternalWorkflowValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExternalWorkflowValidationError";
    this.status = status;
  }
}

export function isExternalWorkflowValidationError(
  err: unknown,
): err is ExternalWorkflowValidationError {
  return err instanceof ExternalWorkflowValidationError;
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function normalizePageSize(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(Math.floor(n), 100);
}

function normalizeSortDir(value: unknown): "ASC" | "DESC" {
  return String(value ?? "").toLowerCase() === "asc" ? "ASC" : "DESC";
}

function normalizePartnerType(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeAssignmentField(value: unknown): ExternalWorkflowAssignmentField {
  return value === "digitizer" ? "digitizer" : "designer";
}

function getOrderBy(sortField?: string | null, sortDir?: "asc" | "desc" | null): string {
  const dir = normalizeSortDir(sortDir);

  const map: Record<ExternalWorkflowSortField, string> = {
    requestNumber: `dwr.request_number ${dir}`,
    statusLabel: `s.label ${dir}`,
    tapeNumber: `COALESCE(dwr.tape_number, '') ${dir}`,
    tapeName: `COALESCE(dwr.tape_name, '') ${dir}`,
    customerName: `COALESCE(dwr.customer_name, '') ${dir}`,
    styleCode: `COALESCE(dwr.style_code, '') ${dir}`,
    dueDate: `dwr.due_date ${dir} NULLS LAST`,
    designerName: `COALESCE(dwr.designer_name, '') ${dir}`,
    digitizerName: `COALESCE(dwr.digitizer_name, '') ${dir}`,
    rush: `dwr.rush ${dir}`,
    createdAt: `dwr.created_at ${dir}`,
  };

  if (sortField && Object.prototype.hasOwnProperty.call(map, sortField)) {
    return map[sortField as ExternalWorkflowSortField];
  }

  return `dwr.due_date ASC NULLS LAST, dwr.created_at DESC, dwr.request_number DESC`;
}

function externalVisibilityJoinSql(partnerTypeParam: string, partnerIdParam: string): string {
  return `
    JOIN LATERAL (
      SELECT
        ewsa.assignment_field,
        ewsa.visibility_mode,
        ewsa.complete_to_status_code
      FROM public.external_workflow_status_access ewsa
      WHERE ewsa.module_key = '${EXTERNAL_MODULE_KEYS.DESIGN_WORKFLOW}'
        AND ewsa.partner_type = ${partnerTypeParam}
        AND ewsa.status_code = s.code
        AND ewsa.is_active = true
        AND (
          (
            ewsa.assignment_field = 'designer'
            AND (
              (
                ewsa.visibility_mode = 'blank_or_same_partner'
                AND (
                  (
                    NULLIF(BTRIM(COALESCE(dwr.designer_user_id, '')), '') IS NULL
                    AND NULLIF(BTRIM(COALESCE(dwr.designer_name, '')), '') IS NULL
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM public.external_partner_users epu
                    WHERE epu.partner_id = ${partnerIdParam}::uuid
                      AND epu.user_id::text = NULLIF(BTRIM(COALESCE(dwr.designer_user_id, '')), '')
                      AND epu.is_active = true
                  )
                )
              )
              OR (
                ewsa.visibility_mode = 'same_partner_only'
                AND EXISTS (
                  SELECT 1
                  FROM public.external_partner_users epu
                  WHERE epu.partner_id = ${partnerIdParam}::uuid
                    AND epu.user_id::text = NULLIF(BTRIM(COALESCE(dwr.designer_user_id, '')), '')
                    AND epu.is_active = true
                )
              )
            )
          )
          OR (
            ewsa.assignment_field = 'digitizer'
            AND (
              (
                ewsa.visibility_mode = 'blank_or_same_partner'
                AND (
                  (
                    NULLIF(BTRIM(COALESCE(dwr.digitizer_user_id, '')), '') IS NULL
                    AND NULLIF(BTRIM(COALESCE(dwr.digitizer_name, '')), '') IS NULL
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM public.external_partner_users epu
                    WHERE epu.partner_id = ${partnerIdParam}::uuid
                      AND epu.user_id::text = NULLIF(BTRIM(COALESCE(dwr.digitizer_user_id, '')), '')
                      AND epu.is_active = true
                  )
                )
              )
              OR (
                ewsa.visibility_mode = 'same_partner_only'
                AND EXISTS (
                  SELECT 1
                  FROM public.external_partner_users epu
                  WHERE epu.partner_id = ${partnerIdParam}::uuid
                    AND epu.user_id::text = NULLIF(BTRIM(COALESCE(dwr.digitizer_user_id, '')), '')
                    AND epu.is_active = true
                )
              )
            )
          )
        )
      ORDER BY ewsa.created_at ASC
      LIMIT 1
    ) ewa ON true
  `;
}

function baseFromSql(partnerTypeParam: string, partnerIdParam: string): string {
  return `
    FROM public.design_workflow_requests dwr
    JOIN public.design_workflow_statuses s
      ON s.id = dwr.status_id
    ${externalVisibilityJoinSql(partnerTypeParam, partnerIdParam)}
  `;
}

function selectSql(): string {
  return `
    SELECT
      dwr.id::text,
      dwr.request_number,
      dwr.sales_order_number,
      dwr.sales_order_base,
      COALESCE(dwr.sales_order_display, dwr.sales_order_number, dwr.sales_order_base) AS sales_order_display,
      dwr.po_number,
      dwr.tape_name,
      dwr.date_request_created,
      dwr.due_date,
      dwr.customer_name,
      dwr.customer_code,
      dwr.bin_code,
      dwr.digitizer_user_id,
      dwr.digitizer_name,
      dwr.designer_user_id,
      dwr.designer_name,
      dwr.status_id,
      s.code AS status_code,
      s.label AS status_label,
      dwr.instructions,
      dwr.additional_instructions,
      dwr.colorways_text,
      dwr.tape_number,
      dwr.rush,
      dwr.style_code,
      dwr.sample_so_number,
      dwr.stitch_count,
      dwr.art_proof,
      dwr.created_at,
      dwr.updated_at,
      ewa.assignment_field AS external_assignment_field,
      ewa.visibility_mode AS external_visibility_mode,
      ewa.complete_to_status_code AS external_complete_to_status_code
  `;
}

function addListFilters(
  opts: ExternalWorkflowListOptions,
  params: any[],
  where: string[],
): void {
  where.push(`COALESCE(dwr.is_voided, false) = false`);

  const statusCode = cleanText(opts.statusCode);
  if (statusCode) {
    params.push(statusCode);
    where.push(`s.code = $${params.length}`);
  }

  const dueDateFrom = cleanText(opts.dueDateFrom);
  if (dueDateFrom) {
    params.push(dueDateFrom);
    where.push(`dwr.due_date >= $${params.length}`);
  }

  const dueDateTo = cleanText(opts.dueDateTo);
  if (dueDateTo) {
    params.push(dueDateTo);
    where.push(`dwr.due_date <= $${params.length}`);
  }

  const search = cleanText(opts.search);
  if (search) {
    params.push(`%${search}%`);
    const ref = `$${params.length}`;
    where.push(`
      (
        COALESCE(dwr.request_number, '') ILIKE ${ref}
        OR COALESCE(dwr.sales_order_number, '') ILIKE ${ref}
        OR COALESCE(dwr.sales_order_base, '') ILIKE ${ref}
        OR COALESCE(dwr.po_number, '') ILIKE ${ref}
        OR COALESCE(dwr.tape_number, '') ILIKE ${ref}
        OR COALESCE(dwr.tape_name, '') ILIKE ${ref}
        OR COALESCE(dwr.customer_name, '') ILIKE ${ref}
        OR COALESCE(dwr.customer_code, '') ILIKE ${ref}
        OR COALESCE(dwr.style_code, '') ILIKE ${ref}
        OR COALESCE(dwr.designer_name, '') ILIKE ${ref}
        OR COALESCE(dwr.digitizer_name, '') ILIKE ${ref}
        OR COALESCE(s.label, '') ILIKE ${ref}
      )
    `);
  }
}

function mapWorkflowRow(row: any): ExternalWorkflowRow {
  return {
    id: row.id,
    requestNumber: row.request_number ?? "",
    salesOrderNumber: row.sales_order_number ?? null,
    salesOrderBase: row.sales_order_base ?? null,
    salesOrderDisplay: row.sales_order_display ?? null,
    poNumber: row.po_number ?? null,
    tapeName: row.tape_name ?? null,
    dateRequestCreated: row.date_request_created ?? null,
    dueDate: row.due_date ?? null,
    customerName: row.customer_name ?? null,
    customerCode: row.customer_code ?? null,
    binCode: row.bin_code ?? null,
    digitizerUserId: row.digitizer_user_id ?? null,
    digitizerName: row.digitizer_name ?? null,
    designerUserId: row.designer_user_id ?? null,
    designerName: row.designer_name ?? null,
    statusId: Number(row.status_id),
    statusCode: row.status_code ?? "",
    statusLabel: row.status_label ?? "",
    instructions: row.instructions ?? null,
    additionalInstructions: row.additional_instructions ?? null,
    colorwaysText: row.colorways_text ?? null,
    tapeNumber: row.tape_number ?? null,
    rush: !!row.rush,
    styleCode: row.style_code ?? null,
    sampleSoNumber: row.sample_so_number ?? null,
    stitchCount: row.stitch_count == null ? null : Number(row.stitch_count),
    artProof: !!row.art_proof,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    externalAssignmentField:
      row.external_assignment_field === "digitizer" ? "digitizer" : "designer",
    externalVisibilityMode: row.external_visibility_mode ?? "",
    externalCompleteToStatusCode: row.external_complete_to_status_code ?? null,
  };
}

function mapAssignableUser(row: any): ExternalAssignableWorkflowUser {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? row.name ?? row.username ?? "Unknown User",
    email: row.email ?? null,
    employeeNumber: row.employee_number == null ? null : Number(row.employee_number),
    role: row.role ?? null,
    department: row.department ?? null,
    externalRole: row.external_role ?? "",
  };
}

function allowedExternalRolesForField(field: ExternalWorkflowAssignmentField): string[] {
  return field === "digitizer"
    ? ["EXTERNAL_DIGITIZER", "EXTERNAL_WORKFLOW_PARTNER"]
    : ["EXTERNAL_DESIGNER", "EXTERNAL_WORKFLOW_PARTNER"];
}

function assertPartnerCanUseAssignmentField(
  partner: ExternalPartnerContext,
  field: ExternalWorkflowAssignmentField,
) {
  const partnerType = normalizePartnerType(partner.externalPartnerType);

  if (field === "designer" && partnerType !== EXTERNAL_PARTNER_TYPES.WORKFLOW_DESIGN) {
    throw new ExternalWorkflowValidationError(
      "This partner is not allowed to assign Workflow designers.",
      403,
    );
  }

  if (
    field === "digitizer" &&
    partnerType !== EXTERNAL_PARTNER_TYPES.WORKFLOW_DIGITIZING
  ) {
    throw new ExternalWorkflowValidationError(
      "This partner is not allowed to assign Workflow digitizers.",
      403,
    );
  }
}

async function getPartnerAssignableUserById(
  query: QueryFn,
  partner: ExternalPartnerContext,
  selectedUserId: string,
  field: ExternalWorkflowAssignmentField,
): Promise<ExternalAssignableWorkflowUser | null> {
  const cleanedUserId = cleanText(selectedUserId);
  if (!cleanedUserId) return null;

  const allowedRoles = allowedExternalRolesForField(field);

  const { rows } = await query<any>(
    `
    SELECT
      u.id::text AS id,
      u.username,
      u.display_name,
      u.name,
      u.email,
      u.employee_number,
      u.role,
      u.department,
      epu.external_role
    FROM public.external_partner_users epu
    JOIN public.users u
      ON u.id = epu.user_id
     AND u.is_active = true
    WHERE epu.partner_id = $1::uuid
      AND epu.user_id = $2::uuid
      AND epu.is_active = true
      AND epu.external_role = ANY($3::text[])
    LIMIT 1
    `,
    [partner.externalPartnerId, cleanedUserId, allowedRoles],
  );

  return rows[0] ? mapAssignableUser(rows[0]) : null;
}

async function insertPartnerAssignmentActivity(query: QueryFn, args: {
  requestId: string;
  field: ExternalWorkflowAssignmentField;
  previousName: string | null;
  newName: string | null;
  actor: ExternalWorkflowActor;
  partner: ExternalPartnerContext;
  salesOrder: string | null;
}) {
  const label = args.field === "digitizer" ? "Digitizer" : "Designer";
  const actorLabel = args.actor.actorName || args.partner.externalPartnerName || "External Partner";
  const message = `${label} assigned by ${actorLabel}`;
  const salesOrderNumber = Number(args.salesOrder);

  await query(
    `
    INSERT INTO public.activity_history (
      entity_type,
      entity_id,
      event_type,
      field_name,
      previous_value,
      new_value,
      message,
      module,
      user_id,
      user_name,
      employee_number,
      sales_order
    )
    VALUES (
      'design_workflow',
      $1,
      'updated',
      $2,
      $3::jsonb,
      $4::jsonb,
      $5,
      'design_workflow',
      $6::uuid,
      $7,
      NULL,
      $8
    )
    `,
    [
      args.requestId,
      args.field,
      JSON.stringify(args.previousName ?? null),
      JSON.stringify(args.newName ?? null),
      message,
      args.actor.userId,
      actorLabel,
      Number.isFinite(salesOrderNumber) ? salesOrderNumber : null,
    ],
  );
}

export async function listPartnerVisibleWorkflowRequests(
  query: QueryFn,
  partner: ExternalPartnerContext,
  opts: ExternalWorkflowListOptions = {},
): Promise<ExternalWorkflowPagedResult> {
  const page = normalizePage(opts.page);
  const pageSize = normalizePageSize(opts.pageSize);
  const offset = (page - 1) * pageSize;

  const params: any[] = [
    partner.externalPartnerType,
    partner.externalPartnerId,
  ];

  const where: string[] = [];
  addListFilters(opts, params, where);

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const fromSql = baseFromSql("$1", "$2");
  const orderBy = getOrderBy(opts.sortField, opts.sortDir);

  const countSql = `
    SELECT COUNT(*)::int AS total
    ${fromSql}
    ${whereClause}
  `;

  params.push(pageSize, offset);
  const dataSql = `
    ${selectSql()}
    ${fromSql}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const countParams = params.slice(0, -2);

  const [countResult, dataResult] = await Promise.all([
    query<{ total: number }>(countSql, countParams),
    query<any>(dataSql, params),
  ]);

  return {
    rows: dataResult.rows.map(mapWorkflowRow),
    totalCount: Number(countResult.rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getPartnerVisibleWorkflowRequestById(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
): Promise<ExternalWorkflowRow | null> {
  const cleanedRequestId = cleanText(requestId);
  if (!cleanedRequestId) return null;

  const params: any[] = [
    partner.externalPartnerType,
    partner.externalPartnerId,
    cleanedRequestId,
  ];

  const sql = `
    ${selectSql()}
    ${baseFromSql("$1", "$2")}
    WHERE COALESCE(dwr.is_voided, false) = false
      AND dwr.id = $3::uuid
    LIMIT 1
  `;

  const { rows } = await query<any>(sql, params);
  return rows[0] ? mapWorkflowRow(rows[0]) : null;
}

export async function listPartnerAssignableWorkflowUsers(
  query: QueryFn,
  partner: ExternalPartnerContext,
  field: ExternalWorkflowAssignmentField,
  q?: string | null,
): Promise<ExternalAssignableWorkflowUser[]> {
  const normalizedField = normalizeAssignmentField(field);
  assertPartnerCanUseAssignmentField(partner, normalizedField);

  const allowedRoles = allowedExternalRolesForField(normalizedField);
  const params: any[] = [partner.externalPartnerId, allowedRoles];
  const where: string[] = [
    `epu.partner_id = $1::uuid`,
    `epu.is_active = true`,
    `epu.external_role = ANY($2::text[])`,
    `u.is_active = true`,
  ];

  const search = cleanText(q);
  if (search) {
    params.push(`%${search}%`);
    const ref = `$${params.length}`;
    where.push(`
      (
        COALESCE(u.display_name, '') ILIKE ${ref}
        OR COALESCE(u.name, '') ILIKE ${ref}
        OR COALESCE(u.username, '') ILIKE ${ref}
        OR COALESCE(u.email, '') ILIKE ${ref}
        OR CAST(u.employee_number AS text) ILIKE ${ref}
      )
    `);
  }

  const { rows } = await query<any>(
    `
    SELECT
      u.id::text AS id,
      u.username,
      u.display_name,
      u.name,
      u.email,
      u.employee_number,
      u.role,
      u.department,
      epu.external_role
    FROM public.external_partner_users epu
    JOIN public.users u
      ON u.id = epu.user_id
    WHERE ${where.join(" AND ")}
    ORDER BY
      COALESCE(u.display_name, u.name, u.username) ASC,
      u.username ASC
    LIMIT 100
    `,
    params,
  );

  return rows.map(mapAssignableUser);
}

export async function assignPartnerWorkflowUser(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
  selectedUserId: string,
  field: ExternalWorkflowAssignmentField,
  actor: ExternalWorkflowActor,
): Promise<ExternalWorkflowRow> {
  const normalizedField = normalizeAssignmentField(field);
  assertPartnerCanUseAssignmentField(partner, normalizedField);

  const cleanedRequestId = cleanText(requestId);
  if (!cleanedRequestId) {
    throw new ExternalWorkflowValidationError("Workflow request ID is required.");
  }

  const selectedUser = await getPartnerAssignableUserById(
    query,
    partner,
    selectedUserId,
    normalizedField,
  );

  if (!selectedUser) {
    throw new ExternalWorkflowValidationError(
      "Selected user is not active for this external partner.",
      400,
    );
  }

  await query("BEGIN");

  try {
    const before = await getPartnerVisibleWorkflowRequestById(
      query,
      partner,
      cleanedRequestId,
    );

    if (!before) {
      throw new ExternalWorkflowValidationError("Workflow record not found.", 404);
    }

    if (before.externalAssignmentField !== normalizedField) {
      throw new ExternalWorkflowValidationError(
        `This record is not currently routed for ${normalizedField} assignment.`,
        403,
      );
    }

    const previousName =
      normalizedField === "digitizer" ? before.digitizerName : before.designerName;
    const userIdColumn =
      normalizedField === "digitizer" ? "digitizer_user_id" : "designer_user_id";
    const nameColumn =
      normalizedField === "digitizer" ? "digitizer_name" : "designer_name";

    await query(
      `
      UPDATE public.design_workflow_requests
      SET ${userIdColumn} = $2,
          ${nameColumn} = $3,
          updated_at = NOW(),
          updated_by = $4
      WHERE id = $1::uuid
        AND COALESCE(is_voided, false) = false
      `,
      [
        cleanedRequestId,
        selectedUser.id,
        selectedUser.displayName,
        actor.actorName ?? partner.externalPartnerName ?? null,
      ],
    );

    await insertPartnerAssignmentActivity(query, {
      requestId: cleanedRequestId,
      field: normalizedField,
      previousName,
      newName: selectedUser.displayName,
      actor,
      partner,
      salesOrder: before.salesOrderBase ?? before.salesOrderNumber,
    });

    const after = await getPartnerVisibleWorkflowRequestById(
      query,
      partner,
      cleanedRequestId,
    );

    if (!after) {
      throw new ExternalWorkflowValidationError(
        "Assignment was saved, but the updated record is no longer visible to this partner.",
        409,
      );
    }

    await query("COMMIT");
    return after;
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

export async function assignPartnerWorkflowDesigner(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
  selectedUserId: string,
  actor: ExternalWorkflowActor,
): Promise<ExternalWorkflowRow> {
  return assignPartnerWorkflowUser(
    query,
    partner,
    requestId,
    selectedUserId,
    "designer",
    actor,
  );
}

export async function assignPartnerWorkflowDigitizer(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
  selectedUserId: string,
  actor: ExternalWorkflowActor,
): Promise<ExternalWorkflowRow> {
  return assignPartnerWorkflowUser(
    query,
    partner,
    requestId,
    selectedUserId,
    "digitizer",
    actor,
  );
}

export type ExternalWorkflowNoteRow = {
  id: string;
  requestId: string;
  partnerId: string;
  partnerName: string | null;
  noteText: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type ExternalWorkflowCompleteResult = {
  ok: true;
  requestId: string;
  previousStatusCode: string;
  previousStatusLabel: string;
  newStatusCode: string;
  newStatusLabel: string;
};

function mapExternalWorkflowNote(row: any): ExternalWorkflowNoteRow {
  return {
    id: row.id,
    requestId: row.request_id,
    partnerId: row.partner_id,
    partnerName: row.partner_name ?? null,
    noteText: row.note_text ?? "",
    createdByUserId: row.created_by_user_id ?? null,
    createdByName: row.created_by_name ?? null,
    createdAt: row.created_at,
  };
}

async function getWorkflowStatusByCode(
  query: QueryFn,
  statusCode: string,
): Promise<{ id: number; code: string; label: string } | null> {
  const cleanedCode = cleanText(statusCode);
  if (!cleanedCode) return null;

  const { rows } = await query<{ id: number; code: string; label: string }>(
    `
    SELECT id, code, label
    FROM public.design_workflow_statuses
    WHERE code = $1
      AND is_active = true
    LIMIT 1
    `,
    [cleanedCode],
  );

  return rows[0] ?? null;
}

async function assignmentUserBelongsToPartner(
  query: QueryFn,
  partner: ExternalPartnerContext,
  userId: string | null | undefined,
): Promise<boolean> {
  const cleanedUserId = cleanText(userId);
  if (!cleanedUserId) return false;

  const { rows } = await query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.external_partner_users epu
      WHERE epu.partner_id = $1::uuid
        AND epu.user_id = $2::uuid
        AND epu.is_active = true
    ) AS exists
    `,
    [partner.externalPartnerId, cleanedUserId],
  );

  return !!rows[0]?.exists;
}

async function insertPartnerCompleteActivity(query: QueryFn, args: {
  requestId: string;
  field: ExternalWorkflowAssignmentField;
  previousStatusLabel: string;
  newStatusLabel: string;
  actor: ExternalWorkflowActor;
  partner: ExternalPartnerContext;
  salesOrder: string | null;
}) {
  const actorLabel = args.actor.actorName || args.partner.externalPartnerName || "External Partner";
  const workLabel = args.field === "digitizer" ? "digitizing" : "design";
  const salesOrderNumber = Number(args.salesOrder);

  await query(
    `
    INSERT INTO public.activity_history (
      entity_type,
      entity_id,
      event_type,
      field_name,
      previous_value,
      new_value,
      message,
      module,
      user_id,
      user_name,
      employee_number,
      sales_order
    )
    VALUES (
      'design_workflow',
      $1,
      'status_changed',
      'status',
      $2::jsonb,
      $3::jsonb,
      $4,
      'design_workflow',
      $5::uuid,
      $6,
      NULL,
      $7
    )
    `,
    [
      args.requestId,
      JSON.stringify(args.previousStatusLabel),
      JSON.stringify(args.newStatusLabel),
      `${args.partner.externalPartnerName || "External partner"} completed ${workLabel}. Status changed to ${args.newStatusLabel}.`,
      args.actor.userId,
      actorLabel,
      Number.isFinite(salesOrderNumber) ? salesOrderNumber : null,
    ],
  );
}

export async function listPartnerWorkflowNotes(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
): Promise<ExternalWorkflowNoteRow[]> {
  const visible = await getPartnerVisibleWorkflowRequestById(query, partner, requestId);
  if (!visible) {
    throw new ExternalWorkflowValidationError("Workflow record not found.", 404);
  }

  const { rows } = await query<any>(
    `
    SELECT
      n.id::text AS id,
      n.request_id::text AS request_id,
      n.partner_id::text AS partner_id,
      ep.name AS partner_name,
      n.note_text,
      n.created_by_user_id::text AS created_by_user_id,
      n.created_by_name,
      n.created_at
    FROM public.design_workflow_external_notes n
    JOIN public.external_partners ep
      ON ep.id = n.partner_id
    WHERE n.request_id = $1::uuid
      AND n.partner_id = $2::uuid
    ORDER BY n.created_at DESC, n.id DESC
    `,
    [requestId, partner.externalPartnerId],
  );

  return rows.map(mapExternalWorkflowNote);
}

export async function addPartnerWorkflowNote(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
  noteText: string,
  actor: ExternalWorkflowActor,
): Promise<ExternalWorkflowNoteRow> {
  const cleanedNote = cleanText(noteText);
  if (!cleanedNote) {
    throw new ExternalWorkflowValidationError("Note text is required.");
  }

  if (cleanedNote.length > 4000) {
    throw new ExternalWorkflowValidationError("Note text must be 4,000 characters or less.");
  }

  const visible = await getPartnerVisibleWorkflowRequestById(query, partner, requestId);
  if (!visible) {
    throw new ExternalWorkflowValidationError("Workflow record not found.", 404);
  }

  await query("BEGIN");

  try {
    const { rows } = await query<any>(
      `
      INSERT INTO public.design_workflow_external_notes (
        request_id,
        partner_id,
        note_text,
        created_by_user_id,
        created_by_name
      )
      VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5)
      RETURNING
        id::text AS id,
        request_id::text AS request_id,
        partner_id::text AS partner_id,
        $6::text AS partner_name,
        note_text,
        created_by_user_id::text AS created_by_user_id,
        created_by_name,
        created_at
      `,
      [
        requestId,
        partner.externalPartnerId,
        cleanedNote,
        actor.userId,
        actor.actorName ?? partner.externalPartnerName ?? null,
        partner.externalPartnerName ?? null,
      ],
    );

    const note = mapExternalWorkflowNote(rows[0]);
    const salesOrderNumber = Number(visible.salesOrderBase ?? visible.salesOrderNumber);

    await query(
      `
      INSERT INTO public.activity_history (
        entity_type,
        entity_id,
        event_type,
        field_name,
        new_value,
        message,
        module,
        user_id,
        user_name,
        employee_number,
        sales_order
      )
      VALUES (
        'design_workflow',
        $1,
        'comment_added',
        'external_partner_note',
        $2::jsonb,
        $3,
        'design_workflow',
        $4::uuid,
        $5,
        NULL,
        $6
      )
      `,
      [
        requestId,
        JSON.stringify({ noteId: note.id, partnerCode: partner.externalPartnerCode }),
        `External partner note added by ${actor.actorName || partner.externalPartnerName || "External Partner"}.`,
        actor.userId,
        actor.actorName ?? partner.externalPartnerName ?? null,
        Number.isFinite(salesOrderNumber) ? salesOrderNumber : null,
      ],
    );

    await query("COMMIT");
    return note;
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

export async function completePartnerWorkflowRequest(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
  expectedField: ExternalWorkflowAssignmentField,
  actor: ExternalWorkflowActor,
): Promise<ExternalWorkflowCompleteResult> {
  const normalizedField = normalizeAssignmentField(expectedField);
  assertPartnerCanUseAssignmentField(partner, normalizedField);

  const cleanedRequestId = cleanText(requestId);
  if (!cleanedRequestId) {
    throw new ExternalWorkflowValidationError("Workflow request ID is required.");
  }

  await query("BEGIN");

  try {
    const before = await getPartnerVisibleWorkflowRequestById(
      query,
      partner,
      cleanedRequestId,
    );

    if (!before) {
      throw new ExternalWorkflowValidationError("Workflow record not found.", 404);
    }

    if (before.externalAssignmentField !== normalizedField) {
      throw new ExternalWorkflowValidationError(
        `This record is not currently routed for ${normalizedField} completion.`,
        403,
      );
    }

    const assignedUserId =
      normalizedField === "digitizer" ? before.digitizerUserId : before.designerUserId;

    const assignedToPartner = await assignmentUserBelongsToPartner(
      query,
      partner,
      assignedUserId,
    );

    if (!assignedToPartner) {
      throw new ExternalWorkflowValidationError(
        `A ${normalizedField} from this partner must be assigned before completing this record.`,
        409,
      );
    }

    const targetStatusCode = cleanText(before.externalCompleteToStatusCode);
    if (!targetStatusCode) {
      throw new ExternalWorkflowValidationError(
        "This Workflow status is not configured for external completion.",
        409,
      );
    }

    const targetStatus = await getWorkflowStatusByCode(query, targetStatusCode);
    if (!targetStatus) {
      throw new ExternalWorkflowValidationError(
        `Completion target status ${targetStatusCode} is not active or does not exist.`,
        409,
      );
    }

    const { rows: updatedRows } = await query<any>(
      `
      UPDATE public.design_workflow_requests
      SET status_id = $2,
          updated_at = NOW(),
          updated_by = $3
      WHERE id = $1::uuid
        AND COALESCE(is_voided, false) = false
      RETURNING id::text
      `,
      [
        cleanedRequestId,
        targetStatus.id,
        actor.actorName ?? partner.externalPartnerName ?? null,
      ],
    );

    if (!updatedRows[0]) {
      throw new ExternalWorkflowValidationError("Workflow record not found or is voided.", 404);
    }

    await query(
      `
      INSERT INTO public.design_workflow_status_history
        (request_id, status_id, changed_by_user_id, changed_by_name)
      VALUES ($1::uuid, $2, $3::uuid, $4)
      `,
      [
        cleanedRequestId,
        targetStatus.id,
        actor.userId,
        actor.actorName ?? partner.externalPartnerName ?? null,
      ],
    );

    await insertPartnerCompleteActivity(query, {
      requestId: cleanedRequestId,
      field: normalizedField,
      previousStatusLabel: before.statusLabel || before.statusCode,
      newStatusLabel: targetStatus.label || targetStatus.code,
      actor,
      partner,
      salesOrder: before.salesOrderBase ?? before.salesOrderNumber,
    });

    await query("COMMIT");

    return {
      ok: true,
      requestId: cleanedRequestId,
      previousStatusCode: before.statusCode,
      previousStatusLabel: before.statusLabel,
      newStatusCode: targetStatus.code,
      newStatusLabel: targetStatus.label,
    };
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

export async function completePartnerWorkflowDesign(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
  actor: ExternalWorkflowActor,
): Promise<ExternalWorkflowCompleteResult> {
  return completePartnerWorkflowRequest(query, partner, requestId, "designer", actor);
}

export async function completePartnerWorkflowDigitizing(
  query: QueryFn,
  partner: ExternalPartnerContext,
  requestId: string,
  actor: ExternalWorkflowActor,
): Promise<ExternalWorkflowCompleteResult> {
  return completePartnerWorkflowRequest(query, partner, requestId, "digitizer", actor);
}
