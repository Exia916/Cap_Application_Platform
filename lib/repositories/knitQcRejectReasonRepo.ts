import { db } from "@/lib/db";

/**
 * Repository for Knit QC reject reasons. This module encapsulates all
 * queries related to the `knit_qc_reject_reasons` lookup table. It
 * exposes a simple method to retrieve all active reject reasons in
 * display order. The result set uses camelCase property names as
 * expected by the UI components.
 */

export type KnitQcRejectReason = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Lists all active Knit QC reject reasons ordered by sortOrder and
 * then by label. Only reasons with is_active = true are returned.
 */
export async function listActiveKnitQcRejectReasons(): Promise<KnitQcRejectReason[]> {
  const { rows } = await db.query<KnitQcRejectReason>(
    `SELECT
      id,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.knit_qc_reject_reasons
    WHERE is_active IS TRUE
    ORDER BY sort_order, label`
  );
  return rows;
}