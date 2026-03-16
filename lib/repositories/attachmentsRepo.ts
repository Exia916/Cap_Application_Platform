import { db } from "@/lib/db";

export type AttachmentRow = {
  id: number;
  entityType: string;
  entityId: string;
  originalFileName: string;
  storedFileName: string;
  storedRelativePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  employeeNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAttachmentInput = {
  entityType: string;
  entityId: string;
  originalFileName: string;
  storedFileName: string;
  storedRelativePath: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  uploadedByUserId?: string | null;
  uploadedByName?: string | null;
  employeeNumber?: number | null;
};

export type DeleteAttachmentInput = {
  id: number;
  deletedByUserId?: string | null;
  deletedByName?: string | null;
};

function cleanText(v: unknown): string {
  return String(v ?? "").trim();
}

export async function createAttachment(input: CreateAttachmentInput): Promise<AttachmentRow> {
  const { rows } = await db.query(
    `
      insert into public.attachments (
        entity_type,
        entity_id,
        original_file_name,
        stored_file_name,
        stored_relative_path,
        mime_type,
        file_size_bytes,
        uploaded_by_user_id,
        uploaded_by_name,
        employee_number
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      returning
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        original_file_name as "originalFileName",
        stored_file_name as "storedFileName",
        stored_relative_path as "storedRelativePath",
        mime_type as "mimeType",
        file_size_bytes as "fileSizeBytes",
        uploaded_by_user_id as "uploadedByUserId",
        uploaded_by_name as "uploadedByName",
        employee_number as "employeeNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [
      cleanText(input.entityType),
      cleanText(input.entityId),
      cleanText(input.originalFileName),
      cleanText(input.storedFileName),
      cleanText(input.storedRelativePath),
      cleanText(input.mimeType) || null,
      input.fileSizeBytes ?? null,
      cleanText(input.uploadedByUserId) || null,
      cleanText(input.uploadedByName) || null,
      input.employeeNumber ?? null,
    ]
  );

  return rows[0] as AttachmentRow;
}

export async function listAttachmentsByEntity(
  entityType: string,
  entityId: string,
  limit = 100
): Promise<AttachmentRow[]> {
  const { rows } = await db.query(
    `
      select
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        original_file_name as "originalFileName",
        stored_file_name as "storedFileName",
        stored_relative_path as "storedRelativePath",
        mime_type as "mimeType",
        file_size_bytes as "fileSizeBytes",
        uploaded_by_user_id as "uploadedByUserId",
        uploaded_by_name as "uploadedByName",
        employee_number as "employeeNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from public.attachments
      where entity_type = $1
        and entity_id = $2
        and is_deleted = false
      order by created_at desc, id desc
      limit $3
    `,
    [cleanText(entityType), cleanText(entityId), limit]
  );

  return rows as AttachmentRow[];
}

export async function getAttachmentById(id: number): Promise<AttachmentRow | null> {
  const { rows } = await db.query(
    `
      select
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        original_file_name as "originalFileName",
        stored_file_name as "storedFileName",
        stored_relative_path as "storedRelativePath",
        mime_type as "mimeType",
        file_size_bytes as "fileSizeBytes",
        uploaded_by_user_id as "uploadedByUserId",
        uploaded_by_name as "uploadedByName",
        employee_number as "employeeNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from public.attachments
      where id = $1
        and is_deleted = false
      limit 1
    `,
    [id]
  );

  return (rows[0] as AttachmentRow | undefined) ?? null;
}

export async function softDeleteAttachment(input: DeleteAttachmentInput): Promise<boolean> {
  const res = await db.query(
    `
      update public.attachments
      set
        is_deleted = true,
        deleted_at = now(),
        deleted_by_user_id = $2,
        deleted_by_name = $3,
        updated_at = now()
      where id = $1
        and is_deleted = false
    `,
    [
      input.id,
      cleanText(input.deletedByUserId) || null,
      cleanText(input.deletedByName) || null,
    ]
  );

  return (res.rowCount ?? 0) > 0;
}