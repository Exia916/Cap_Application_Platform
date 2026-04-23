import { db } from "@/lib/db";

export type AttachmentRow = {
  id: number;
  entityType: string;
  entityId: string;
  originalFileName: string;
  storedFileName: string;
  storedRelativePath: string;
  storageProvider: string;
  bucketName: string | null;
  objectKey: string | null;
  objectVersionId: string | null;
  attachmentComment: string | null;
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
  storageProvider?: string | null;
  bucketName?: string | null;
  objectKey?: string | null;
  objectVersionId?: string | null;
  attachmentComment?: string | null;
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

const SELECT_SQL = `
  select
    id,
    entity_type as "entityType",
    entity_id as "entityId",
    original_file_name as "originalFileName",
    stored_file_name as "storedFileName",
    stored_relative_path as "storedRelativePath",
    storage_provider as "storageProvider",
    bucket_name as "bucketName",
    object_key as "objectKey",
    object_version_id as "objectVersionId",
    attachment_comment as "attachmentComment",
    mime_type as "mimeType",
    file_size_bytes as "fileSizeBytes",
    uploaded_by_user_id as "uploadedByUserId",
    uploaded_by_name as "uploadedByName",
    employee_number as "employeeNumber",
    created_at as "createdAt",
    updated_at as "updatedAt"
  from public.attachments
`;

export async function attachmentFileNameExists(
  entityType: string,
  entityId: string,
  originalFileName: string
): Promise<boolean> {
  const { rows } = await db.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from public.attachments
        where entity_type = $1
          and entity_id = $2
          and lower(original_file_name) = lower($3)
          and is_deleted = false
      ) as exists
    `,
    [cleanText(entityType), cleanText(entityId), cleanText(originalFileName)]
  );

  return !!rows[0]?.exists;
}

export async function createAttachment(input: CreateAttachmentInput): Promise<AttachmentRow> {
  const entityType = cleanText(input.entityType);
  const entityId = cleanText(input.entityId);
  const originalFileName = cleanText(input.originalFileName);

  if (await attachmentFileNameExists(entityType, entityId, originalFileName)) {
    throw new Error("A file with this name already exists for this record. Please rename the file and try again.");
  }

  const { rows } = await db.query(
    `
      insert into public.attachments (
        entity_type,
        entity_id,
        original_file_name,
        stored_file_name,
        stored_relative_path,
        storage_provider,
        bucket_name,
        object_key,
        object_version_id,
        attachment_comment,
        mime_type,
        file_size_bytes,
        uploaded_by_user_id,
        uploaded_by_name,
        employee_number
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      returning
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        original_file_name as "originalFileName",
        stored_file_name as "storedFileName",
        stored_relative_path as "storedRelativePath",
        storage_provider as "storageProvider",
        bucket_name as "bucketName",
        object_key as "objectKey",
        object_version_id as "objectVersionId",
        attachment_comment as "attachmentComment",
        mime_type as "mimeType",
        file_size_bytes as "fileSizeBytes",
        uploaded_by_user_id as "uploadedByUserId",
        uploaded_by_name as "uploadedByName",
        employee_number as "employeeNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [
      entityType,
      entityId,
      originalFileName,
      cleanText(input.storedFileName),
      cleanText(input.storedRelativePath),
      cleanText(input.storageProvider) || "s3",
      cleanText(input.bucketName) || null,
      cleanText(input.objectKey) || null,
      cleanText(input.objectVersionId) || null,
      cleanText(input.attachmentComment) || null,
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
      ${SELECT_SQL}
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
      ${SELECT_SQL}
      where id = $1
        and is_deleted = false
      limit 1
    `,
    [id]
  );

  return (rows[0] as AttachmentRow | undefined) ?? null;
}

export async function updateAttachmentComment(
  id: number,
  attachmentComment: string | null
): Promise<AttachmentRow | null> {
  const { rows } = await db.query(
    `
      update public.attachments
      set
        attachment_comment = $2,
        updated_at = now()
      where id = $1
        and is_deleted = false
      returning
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        original_file_name as "originalFileName",
        stored_file_name as "storedFileName",
        stored_relative_path as "storedRelativePath",
        storage_provider as "storageProvider",
        bucket_name as "bucketName",
        object_key as "objectKey",
        object_version_id as "objectVersionId",
        attachment_comment as "attachmentComment",
        mime_type as "mimeType",
        file_size_bytes as "fileSizeBytes",
        uploaded_by_user_id as "uploadedByUserId",
        uploaded_by_name as "uploadedByName",
        employee_number as "employeeNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [id, cleanText(attachmentComment) || null]
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
