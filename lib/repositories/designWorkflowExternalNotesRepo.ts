export type QueryFn = <T = any>(
  sql: string,
  params?: any[],
) => Promise<{ rows: T[]; rowCount: number }>;

export type InternalDesignWorkflowExternalNoteRow = {
  id: string;
  requestId: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  noteText: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
};

function mapExternalNoteRow(row: any): InternalDesignWorkflowExternalNoteRow {
  return {
    id: String(row.id),
    requestId: String(row.requestId),
    partnerId: String(row.partnerId),
    partnerCode: row.partnerCode ?? "",
    partnerName: row.partnerName ?? "External Partner",
    noteText: row.noteText ?? "",
    createdByUserId: row.createdByUserId ?? null,
    createdByName: row.createdByName ?? null,
    createdAt: row.createdAt,
  };
}

export async function listDesignWorkflowExternalNotesForInternal(
  query: QueryFn,
  requestId: string,
): Promise<InternalDesignWorkflowExternalNoteRow[]> {
  const { rows } = await query(
    `
    SELECT
      n.id::text AS "id",
      n.request_id::text AS "requestId",
      ep.id::text AS "partnerId",
      ep.code AS "partnerCode",
      ep.name AS "partnerName",
      n.note_text AS "noteText",
      n.created_by_user_id::text AS "createdByUserId",
      n.created_by_name AS "createdByName",
      n.created_at AS "createdAt"
    FROM public.design_workflow_external_notes n
    JOIN public.external_partners ep
      ON ep.id = n.partner_id
    WHERE n.request_id = $1::uuid
    ORDER BY n.created_at DESC, n.id DESC
    `,
    [requestId],
  );

  return rows.map(mapExternalNoteRow);
}
