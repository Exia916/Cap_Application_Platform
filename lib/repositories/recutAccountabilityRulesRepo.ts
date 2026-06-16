// lib/repositories/recutAccountabilityRulesRepo.ts

import { db } from "@/lib/db";

export type RecutAccountabilityRuleRow = {
  id: string;
  reasonKey: string;
  reasonLabel: string;
  isAccountable: boolean;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type UnclassifiedRecutReasonRow = {
  recutReasonKey: string;
  recutReason: string;
  recutCount: number;
  recutPieces: number;
  firstRequestedDate: string | null;
  lastRequestedDate: string | null;
};

export type RecutAccountabilityRuleInput = {
  reasonLabel: string;
  isAccountable?: boolean;
  isActive?: boolean;
  notes?: string | null;
  sortOrder?: number | null;
  actor?: string | null;
};

function cleanReasonLabel(value: unknown) {
  const reasonLabel = String(value ?? "").trim();

  if (!reasonLabel) {
    throw new Error("Reason label is required.");
  }

  return reasonLabel;
}

function cleanNotes(value: unknown) {
  const notes = String(value ?? "").trim();
  return notes ? notes : null;
}

function cleanSortOrder(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function cleanBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanActor(value: unknown) {
  const actor = String(value ?? "").trim();
  return actor ? actor : null;
}

const ruleSelectSql = `
  SELECT
    id,
    reason_key AS "reasonKey",
    reason_label AS "reasonLabel",
    is_accountable AS "isAccountable",
    notes,
    is_active AS "isActive",
    sort_order AS "sortOrder",
    created_at AS "createdAt",
    created_by AS "createdBy",
    updated_at AS "updatedAt",
    updated_by AS "updatedBy"
  FROM public.recut_reason_accountability_rules
`;

export async function listRecutAccountabilityRules(): Promise<RecutAccountabilityRuleRow[]> {
  const { rows } = await db.query<RecutAccountabilityRuleRow>(
    `
    ${ruleSelectSql}
    ORDER BY sort_order ASC, reason_label ASC, reason_key ASC
    `
  );

  return rows;
}

export async function listUnclassifiedRecutReasons(): Promise<UnclassifiedRecutReasonRow[]> {
  const { rows } = await db.query<UnclassifiedRecutReasonRow>(
    `
    SELECT
      recut_reason_key AS "recutReasonKey",
      recut_reason AS "recutReason",
      recut_count AS "recutCount",
      recut_pieces AS "recutPieces",
      first_requested_date AS "firstRequestedDate",
      last_requested_date AS "lastRequestedDate"
    FROM reporting.v_unclassified_recut_reasons
    ORDER BY recut_count DESC, recut_pieces DESC, recut_reason ASC
    `
  );

  return rows;
}

export async function createRecutAccountabilityRule(
  input: RecutAccountabilityRuleInput
): Promise<RecutAccountabilityRuleRow> {
  const reasonLabel = cleanReasonLabel(input.reasonLabel);
  const isAccountable = cleanBoolean(input.isAccountable, true);
  const isActive = cleanBoolean(input.isActive, true);
  const notes = cleanNotes(input.notes);
  const sortOrder = cleanSortOrder(input.sortOrder);
  const actor = cleanActor(input.actor);

  const { rows } = await db.query<RecutAccountabilityRuleRow>(
    `
    INSERT INTO public.recut_reason_accountability_rules (
      reason_key,
      reason_label,
      is_accountable,
      notes,
      is_active,
      sort_order,
      created_by,
      updated_by
    )
    VALUES (
      public.cap_report_normalize_key($1),
      btrim($1),
      $2,
      $3,
      $4,
      $5,
      $6,
      $6
    )
    ON CONFLICT (reason_key)
    DO UPDATE SET
      reason_label = EXCLUDED.reason_label,
      is_accountable = EXCLUDED.is_accountable,
      notes = EXCLUDED.notes,
      is_active = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    RETURNING
      id,
      reason_key AS "reasonKey",
      reason_label AS "reasonLabel",
      is_accountable AS "isAccountable",
      notes,
      is_active AS "isActive",
      sort_order AS "sortOrder",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    [reasonLabel, isAccountable, notes, isActive, sortOrder, actor]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create recut accountability rule.");
  }

  return row;
}

export async function updateRecutAccountabilityRule(
  id: string,
  input: RecutAccountabilityRuleInput
): Promise<RecutAccountabilityRuleRow | null> {
  const cleanId = String(id ?? "").trim();
  const reasonLabel = cleanReasonLabel(input.reasonLabel);
  const isAccountable = cleanBoolean(input.isAccountable, true);
  const isActive = cleanBoolean(input.isActive, true);
  const notes = cleanNotes(input.notes);
  const sortOrder = cleanSortOrder(input.sortOrder);
  const actor = cleanActor(input.actor);

  if (!cleanId) {
    throw new Error("Rule ID is required.");
  }

  const { rows } = await db.query<RecutAccountabilityRuleRow>(
    `
    UPDATE public.recut_reason_accountability_rules
    SET
      reason_key = public.cap_report_normalize_key($2),
      reason_label = btrim($2),
      is_accountable = $3,
      notes = $4,
      is_active = $5,
      sort_order = $6,
      updated_at = NOW(),
      updated_by = $7
    WHERE id = $1
    RETURNING
      id,
      reason_key AS "reasonKey",
      reason_label AS "reasonLabel",
      is_accountable AS "isAccountable",
      notes,
      is_active AS "isActive",
      sort_order AS "sortOrder",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    [cleanId, reasonLabel, isAccountable, notes, isActive, sortOrder, actor]
  );

  return rows[0] ?? null;
}