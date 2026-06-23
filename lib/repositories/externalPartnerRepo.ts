import { db } from "@/lib/db";

export type QueryFn = <T = any>(
  sql: string,
  params?: any[],
) => Promise<{ rows: T[]; rowCount: number }>;

export type ExternalModuleAccess = {
  moduleKey: string;
  canView: boolean;
  canAssignSelf: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canNote: boolean;
  canComplete: boolean;
  isActive: boolean;
};

export type ExternalPartnerContext = {
  externalPartnerUserId: string;
  externalPartnerId: string;
  externalPartnerCode: string;
  externalPartnerName: string;
  externalPartnerType: string;
  externalRole: string;
  externalModules: ExternalModuleAccess[];
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * Important:
 * lib/auth.ts adds a legacy `userId` alias that maps to employeeNumber.
 * For partner access, use auth.id because it maps to public.users.id.
 */
export function getAuthUserId(auth: unknown): string | null {
  const value = (auth as any)?.id ?? (auth as any)?.sub ?? null;
  const cleaned = cleanText(value);
  return cleaned || null;
}

function normalizeModules(value: unknown): ExternalModuleAccess[] {
  if (Array.isArray(value)) return value as ExternalModuleAccess[];

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

export async function getExternalPartnerContextForUserId(
  userId: string | null | undefined,
  query: QueryFn = db.query.bind(db),
): Promise<ExternalPartnerContext | null> {
  const cleanedUserId = cleanText(userId);
  if (!cleanedUserId) return null;

  const { rows } = await query<{
    externalPartnerUserId: string;
    externalPartnerId: string;
    externalPartnerCode: string;
    externalPartnerName: string;
    externalPartnerType: string;
    externalRole: string;
    externalModules: unknown;
  }>(
    `
    SELECT
      epu.id::text AS "externalPartnerUserId",
      ep.id::text AS "externalPartnerId",
      ep.code AS "externalPartnerCode",
      ep.name AS "externalPartnerName",
      ep.partner_type AS "externalPartnerType",
      epu.external_role AS "externalRole",
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
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
        ) FILTER (WHERE epma.id IS NOT NULL),
        '[]'::jsonb
      ) AS "externalModules"
    FROM public.external_partner_users epu
    JOIN public.external_partners ep
      ON ep.id = epu.partner_id
     AND ep.is_active = true
    LEFT JOIN public.external_partner_module_access epma
      ON epma.partner_id = ep.id
     AND epma.is_active = true
    WHERE epu.user_id = $1::uuid
      AND epu.is_active = true
    GROUP BY
      epu.id,
      ep.id,
      ep.code,
      ep.name,
      ep.partner_type,
      epu.external_role
    ORDER BY epu.created_at DESC
    LIMIT 1
    `,
    [cleanedUserId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    externalPartnerUserId: row.externalPartnerUserId,
    externalPartnerId: row.externalPartnerId,
    externalPartnerCode: row.externalPartnerCode,
    externalPartnerName: row.externalPartnerName,
    externalPartnerType: row.externalPartnerType,
    externalRole: row.externalRole,
    externalModules: normalizeModules(row.externalModules),
  };
}

export async function isExternalPartnerUserId(
  userId: string | null | undefined,
  query: QueryFn = db.query.bind(db),
): Promise<boolean> {
  const ctx = await getExternalPartnerContextForUserId(userId, query);
  return !!ctx;
}