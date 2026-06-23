import { db } from "@/lib/db";

export type QueryFn = <T = any>(
  sql: string,
  params?: any[],
) => Promise<{ rows: T[]; rowCount: number }>;

export type ExternalPartnerAdminModuleAccess = {
  id: string | null;
  moduleKey: string;
  canView: boolean;
  canAssignSelf: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canNote: boolean;
  canComplete: boolean;
  isActive: boolean;
};

export type ExternalPartnerAdminUser = {
  id: string;
  partnerId: string;
  userId: string;
  username: string;
  displayName: string | null;
  name: string | null;
  email: string | null;
  capRole: string | null;
  department: string | null;
  userIsActive: boolean;
  externalRole: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExternalPartnerAdminPartner = {
  id: string;
  code: string;
  name: string;
  partnerType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  activeUserCount: number;
  moduleAccess: ExternalPartnerAdminModuleAccess[];
  users: ExternalPartnerAdminUser[];
};

export type ExternalPartnerAvailableUser = {
  id: string;
  username: string;
  displayName: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  isActive: boolean;
  externalPartnerId: string | null;
  externalPartnerCode: string | null;
  externalPartnerName: string | null;
  externalRole: string | null;
  externalLinkIsActive: boolean | null;
};

const PARTNER_TYPES = new Set([
  "WORKFLOW_DESIGN",
  "WORKFLOW_DIGITIZING",
  "PRODUCTION",
]);

const EXTERNAL_ROLES = new Set([
  "EXTERNAL_DESIGNER",
  "EXTERNAL_DIGITIZER",
  "EXTERNAL_WORKFLOW_PARTNER",
  "EXTERNAL_VIEWER",
]);

const MODULE_KEYS = new Set(["design_workflow"]);

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normCode(value: unknown): string {
  return cleanText(value)
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .toUpperCase();
}

function boolValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function externalPartnerAdminUniqueMessage(err: any, fallback: string) {
  const message = String(err?.message || "").toLowerCase();
  const constraint = String(err?.constraint || "").toLowerCase();

  if (
    constraint.includes("one_active_partner") ||
    (message.includes("duplicate") && message.includes("user_id"))
  ) {
    return "That CAP user already has an active external partner link. Deactivate the existing link before adding another active partner.";
  }

  if (constraint.includes("partner_user") || message.includes("duplicate")) {
    return "That CAP user is already linked to this partner.";
  }

  return process.env.NODE_ENV === "production" ? fallback : err?.message || fallback;
}

export async function listExternalPartnersAdmin(
  query: QueryFn = db.query.bind(db),
): Promise<ExternalPartnerAdminPartner[]> {
  const { rows } = await query<{
    id: string;
    code: string;
    name: string;
    partnerType: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    userCount: number;
    activeUserCount: number;
    moduleAccess: unknown;
    users: unknown;
  }>(`
    WITH partner_users AS (
      SELECT
        epu.partner_id,
        jsonb_agg(
          jsonb_build_object(
            'id', epu.id::text,
            'partnerId', epu.partner_id::text,
            'userId', u.id::text,
            'username', u.username,
            'displayName', u.display_name,
            'name', u.name,
            'email', u.email,
            'capRole', u.role,
            'department', u.department,
            'userIsActive', COALESCE(u.is_active, false),
            'externalRole', epu.external_role,
            'isActive', COALESCE(epu.is_active, false),
            'createdAt', epu.created_at,
            'updatedAt', epu.updated_at
          )
          ORDER BY COALESCE(u.display_name, u.name, u.username), u.username
        ) AS users,
        COUNT(*)::int AS user_count,
        COUNT(*) FILTER (WHERE epu.is_active = true)::int AS active_user_count
      FROM public.external_partner_users epu
      JOIN public.users u ON u.id = epu.user_id
      GROUP BY epu.partner_id
    ),
    module_access AS (
      SELECT
        epma.partner_id,
        jsonb_agg(
          jsonb_build_object(
            'id', epma.id::text,
            'moduleKey', epma.module_key,
            'canView', COALESCE(epma.can_view, false),
            'canAssignSelf', COALESCE(epma.can_assign_self, false),
            'canUpload', COALESCE(epma.can_upload, false),
            'canDownload', COALESCE(epma.can_download, false),
            'canNote', COALESCE(epma.can_note, false),
            'canComplete', COALESCE(epma.can_complete, false),
            'isActive', COALESCE(epma.is_active, false)
          )
          ORDER BY epma.module_key
        ) AS module_access
      FROM public.external_partner_module_access epma
      GROUP BY epma.partner_id
    )
    SELECT
      ep.id::text AS id,
      ep.code,
      ep.name,
      ep.partner_type AS "partnerType",
      ep.is_active AS "isActive",
      ep.created_at AS "createdAt",
      ep.updated_at AS "updatedAt",
      COALESCE(pu.user_count, 0)::int AS "userCount",
      COALESCE(pu.active_user_count, 0)::int AS "activeUserCount",
      COALESCE(ma.module_access, '[]'::jsonb) AS "moduleAccess",
      COALESCE(pu.users, '[]'::jsonb) AS users
    FROM public.external_partners ep
    LEFT JOIN partner_users pu ON pu.partner_id = ep.id
    LEFT JOIN module_access ma ON ma.partner_id = ep.id
    ORDER BY
      CASE ep.partner_type
        WHEN 'WORKFLOW_DESIGN' THEN 1
        WHEN 'WORKFLOW_DIGITIZING' THEN 2
        ELSE 3
      END,
      ep.name ASC
  `);

  return rows.map((row) => ({
    ...row,
    moduleAccess: parseJsonArray<ExternalPartnerAdminModuleAccess>(row.moduleAccess),
    users: parseJsonArray<ExternalPartnerAdminUser>(row.users),
  }));
}

export async function listAvailableExternalPartnerUsers(
  query: QueryFn = db.query.bind(db),
): Promise<ExternalPartnerAvailableUser[]> {
  const { rows } = await query<ExternalPartnerAvailableUser>(`
    SELECT
      u.id::text AS id,
      u.username,
      u.display_name AS "displayName",
      u.name,
      u.email,
      u.role,
      u.department,
      COALESCE(u.is_active, false) AS "isActive",
      ep.id::text AS "externalPartnerId",
      ep.code AS "externalPartnerCode",
      ep.name AS "externalPartnerName",
      epu.external_role AS "externalRole",
      epu.is_active AS "externalLinkIsActive"
    FROM public.users u
    LEFT JOIN public.external_partner_users epu
      ON epu.user_id = u.id
     AND epu.is_active = true
    LEFT JOIN public.external_partners ep
      ON ep.id = epu.partner_id
    WHERE COALESCE(u.is_active, false) = true
    ORDER BY
      CASE WHEN epu.id IS NULL THEN 0 ELSE 1 END,
      COALESCE(u.display_name, u.name, u.username),
      u.username
  `);

  return rows;
}

export async function updateExternalPartnerAdmin(
  params: {
    partnerId: string;
    name?: unknown;
    partnerType?: unknown;
    isActive?: unknown;
    actorUserId?: string | null;
  },
  query: QueryFn = db.query.bind(db),
): Promise<ExternalPartnerAdminPartner | null> {
  const partnerId = cleanText(params.partnerId);
  if (!partnerId) throw new Error("Missing partner id");

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (params.name !== undefined) {
    const name = cleanText(params.name);
    if (!name) throw new Error("Partner name is required");
    fields.push(`name = $${idx++}`);
    values.push(name);
  }

  if (params.partnerType !== undefined) {
    const partnerType = normCode(params.partnerType);
    if (!PARTNER_TYPES.has(partnerType)) throw new Error("Invalid partner type");
    fields.push(`partner_type = $${idx++}`);
    values.push(partnerType);
  }

  if (params.isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(boolValue(params.isActive, true));
  }

  if (!fields.length) {
    const partners = await listExternalPartnersAdmin(query);
    return partners.find((p) => p.id === partnerId) ?? null;
  }

  fields.push(`updated_at = NOW()`);
  fields.push(`updated_by = $${idx++}::uuid`);
  values.push(params.actorUserId ?? null);

  await query(
    `
    UPDATE public.external_partners
    SET ${fields.join(", ")}
    WHERE id = $${idx}::uuid
    `,
    [...values, partnerId],
  );

  const partners = await listExternalPartnersAdmin(query);
  return partners.find((p) => p.id === partnerId) ?? null;
}

export async function upsertExternalPartnerModuleAccessAdmin(
  params: {
    partnerId: string;
    moduleKey: unknown;
    canView?: unknown;
    canAssignSelf?: unknown;
    canUpload?: unknown;
    canDownload?: unknown;
    canNote?: unknown;
    canComplete?: unknown;
    isActive?: unknown;
    actorUserId?: string | null;
  },
  query: QueryFn = db.query.bind(db),
): Promise<ExternalPartnerAdminModuleAccess> {
  const partnerId = cleanText(params.partnerId);
  const moduleKey = cleanText(params.moduleKey || "design_workflow");

  if (!partnerId) throw new Error("Missing partner id");
  if (!MODULE_KEYS.has(moduleKey)) throw new Error("Invalid external module key");

  const canView = boolValue(params.canView, false);
  const canAssignSelf = boolValue(params.canAssignSelf, false);
  const canUpload = boolValue(params.canUpload, false);
  const canDownload = boolValue(params.canDownload, false);
  const canNote = boolValue(params.canNote, false);
  const canComplete = boolValue(params.canComplete, false);
  const isActive = boolValue(params.isActive, true);

  const { rows } = await query<ExternalPartnerAdminModuleAccess>(
    `
    INSERT INTO public.external_partner_module_access (
      partner_id,
      module_key,
      can_view,
      can_assign_self,
      can_upload,
      can_download,
      can_note,
      can_complete,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $10::uuid, NOW(), NOW())
    ON CONFLICT (partner_id, module_key) DO UPDATE
    SET
      can_view = EXCLUDED.can_view,
      can_assign_self = EXCLUDED.can_assign_self,
      can_upload = EXCLUDED.can_upload,
      can_download = EXCLUDED.can_download,
      can_note = EXCLUDED.can_note,
      can_complete = EXCLUDED.can_complete,
      is_active = EXCLUDED.is_active,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING
      id::text AS id,
      module_key AS "moduleKey",
      can_view AS "canView",
      can_assign_self AS "canAssignSelf",
      can_upload AS "canUpload",
      can_download AS "canDownload",
      can_note AS "canNote",
      can_complete AS "canComplete",
      is_active AS "isActive"
    `,
    [
      partnerId,
      moduleKey,
      canView,
      canAssignSelf,
      canUpload,
      canDownload,
      canNote,
      canComplete,
      isActive,
      params.actorUserId ?? null,
    ],
  );

  return rows[0];
}

function validateExternalRoleForPartnerType(externalRole: string, partnerType: string) {
  if (!EXTERNAL_ROLES.has(externalRole)) throw new Error("Invalid external role");

  if (partnerType === "WORKFLOW_DESIGN" && externalRole === "EXTERNAL_DIGITIZER") {
    throw new Error("Design partners cannot use the External Digitizer role.");
  }

  if (partnerType === "WORKFLOW_DIGITIZING" && externalRole === "EXTERNAL_DESIGNER") {
    throw new Error("Digitizing partners cannot use the External Designer role.");
  }
}

export async function addExternalPartnerUserAdmin(
  params: {
    partnerId: string;
    userId: string;
    externalRole: unknown;
    isActive?: unknown;
    actorUserId?: string | null;
  },
  query: QueryFn = db.query.bind(db),
): Promise<ExternalPartnerAdminUser> {
  const partnerId = cleanText(params.partnerId);
  const userId = cleanText(params.userId);
  const externalRole = normCode(params.externalRole);
  const isActive = boolValue(params.isActive, true);

  if (!partnerId) throw new Error("Missing partner id");
  if (!userId) throw new Error("Select a CAP user");

  const partnerCheck = await query<{ partnerType: string; isActive: boolean }>(
    `
    SELECT partner_type AS "partnerType", is_active AS "isActive"
    FROM public.external_partners
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [partnerId],
  );

  const partner = partnerCheck.rows[0];
  if (!partner) throw new Error("External partner not found");
  validateExternalRoleForPartnerType(externalRole, partner.partnerType);

  const userCheck = await query<{ id: string }>(
    `
    SELECT id::text AS id
    FROM public.users
    WHERE id = $1::uuid
      AND COALESCE(is_active, false) = true
    LIMIT 1
    `,
    [userId],
  );

  if (!userCheck.rows[0]) throw new Error("Selected CAP user was not found or is inactive");

  const { rows } = await query<ExternalPartnerAdminUser>(
    `
    WITH upserted AS (
      INSERT INTO public.external_partner_users (
        partner_id,
        user_id,
        external_role,
        is_active,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $5::uuid, NOW(), NOW())
      ON CONFLICT (partner_id, user_id) DO UPDATE
      SET
        external_role = EXCLUDED.external_role,
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
    )
    SELECT
      epu.id::text AS id,
      epu.partner_id::text AS "partnerId",
      u.id::text AS "userId",
      u.username,
      u.display_name AS "displayName",
      u.name,
      u.email,
      u.role AS "capRole",
      u.department,
      COALESCE(u.is_active, false) AS "userIsActive",
      epu.external_role AS "externalRole",
      COALESCE(epu.is_active, false) AS "isActive",
      epu.created_at AS "createdAt",
      epu.updated_at AS "updatedAt"
    FROM upserted epu
    JOIN public.users u ON u.id = epu.user_id
    `,
    [partnerId, userId, externalRole, isActive, params.actorUserId ?? null],
  );

  return rows[0];
}

export async function updateExternalPartnerUserAdmin(
  params: {
    userLinkId: string;
    externalRole?: unknown;
    isActive?: unknown;
    actorUserId?: string | null;
  },
  query: QueryFn = db.query.bind(db),
): Promise<ExternalPartnerAdminUser | null> {
  const userLinkId = cleanText(params.userLinkId);
  if (!userLinkId) throw new Error("Missing partner user link id");

  const currentRes = await query<{ partnerType: string }>(
    `
    SELECT ep.partner_type AS "partnerType"
    FROM public.external_partner_users epu
    JOIN public.external_partners ep ON ep.id = epu.partner_id
    WHERE epu.id = $1::uuid
    LIMIT 1
    `,
    [userLinkId],
  );

  const current = currentRes.rows[0];
  if (!current) return null;

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (params.externalRole !== undefined) {
    const externalRole = normCode(params.externalRole);
    validateExternalRoleForPartnerType(externalRole, current.partnerType);
    fields.push(`external_role = $${idx++}`);
    values.push(externalRole);
  }

  if (params.isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(boolValue(params.isActive, true));
  }

  if (!fields.length) {
    throw new Error("No changes provided");
  }

  fields.push(`updated_by = $${idx++}::uuid`);
  values.push(params.actorUserId ?? null);
  fields.push(`updated_at = NOW()`);

  const { rows } = await query<ExternalPartnerAdminUser>(
    `
    WITH updated AS (
      UPDATE public.external_partner_users
      SET ${fields.join(", ")}
      WHERE id = $${idx}::uuid
      RETURNING *
    )
    SELECT
      epu.id::text AS id,
      epu.partner_id::text AS "partnerId",
      u.id::text AS "userId",
      u.username,
      u.display_name AS "displayName",
      u.name,
      u.email,
      u.role AS "capRole",
      u.department,
      COALESCE(u.is_active, false) AS "userIsActive",
      epu.external_role AS "externalRole",
      COALESCE(epu.is_active, false) AS "isActive",
      epu.created_at AS "createdAt",
      epu.updated_at AS "updatedAt"
    FROM updated epu
    JOIN public.users u ON u.id = epu.user_id
    `,
    [...values, userLinkId],
  );

  return rows[0] ?? null;
}

export async function deactivateExternalPartnerUserAdmin(
  params: {
    userLinkId: string;
    actorUserId?: string | null;
  },
  query: QueryFn = db.query.bind(db),
): Promise<ExternalPartnerAdminUser | null> {
  return updateExternalPartnerUserAdmin(
    {
      userLinkId: params.userLinkId,
      isActive: false,
      actorUserId: params.actorUserId,
    },
    query,
  );
}
