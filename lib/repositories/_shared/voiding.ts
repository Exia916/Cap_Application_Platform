type QueryFn = <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;

type VoidRecordParams = {
  tableName: string;
  idColumn: string;
  idValue: number | string;
  userName: string;
  reason?: string | null;
};

type UnvoidRecordParams = {
  tableName: string;
  idColumn: string;
  idValue: number | string;
};

export async function voidRecord(
  query: QueryFn,
  params: VoidRecordParams
) {
  const sql = `
    UPDATE ${params.tableName}
    SET
      is_voided = true,
      voided_at = NOW(),
      voided_by = $2,
      void_reason = $3,
      updated_at = NOW(),
      updated_by = $2
    WHERE ${params.idColumn} = $1
      AND COALESCE(is_voided, false) = false
    RETURNING *
  `;

  return query(sql, [
    params.idValue,
    params.userName,
    params.reason ?? null,
  ]);
}

export async function unvoidRecord(
  query: QueryFn,
  params: UnvoidRecordParams
) {
  const sql = `
    UPDATE ${params.tableName}
    SET
      is_voided = false,
      voided_at = NULL,
      voided_by = NULL,
      void_reason = NULL,
      updated_at = NOW()
    WHERE ${params.idColumn} = $1
      AND COALESCE(is_voided, false) = true
    RETURNING *
  `;

  return query(sql, [params.idValue]);
}