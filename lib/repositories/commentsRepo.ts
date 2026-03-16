import { db } from "@/lib/db";

export type CommentRow = {
  id: number;
  entityType: string;
  entityId: string;
  commentText: string;
  createdByUserId: string | null;
  createdByName: string | null;
  employeeNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCommentInput = {
  entityType: string;
  entityId: string;
  commentText: string;
  createdByUserId?: string | null;
  createdByName?: string | null;
  employeeNumber?: number | null;
};

export type UpdateCommentInput = {
  id: number;
  commentText: string;
};

export type DeleteCommentInput = {
  id: number;
  deletedByUserId?: string | null;
  deletedByName?: string | null;
};

function cleanText(v: unknown): string {
  return String(v ?? "").trim();
}

export async function createComment(input: CreateCommentInput): Promise<CommentRow> {
  const commentText = cleanText(input.commentText);
  if (!commentText) throw new Error("Comment text is required");

  const { rows } = await db.query(
    `
      insert into public.comments (
        entity_type,
        entity_id,
        comment_text,
        created_by_user_id,
        created_by_name,
        employee_number
      )
      values ($1, $2, $3, $4, $5, $6)
      returning
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        comment_text as "commentText",
        created_by_user_id as "createdByUserId",
        created_by_name as "createdByName",
        employee_number as "employeeNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [
      cleanText(input.entityType),
      cleanText(input.entityId),
      commentText,
      cleanText(input.createdByUserId) || null,
      cleanText(input.createdByName) || null,
      input.employeeNumber ?? null,
    ]
  );

  return rows[0] as CommentRow;
}

export async function listCommentsByEntity(
  entityType: string,
  entityId: string,
  limit = 100
): Promise<CommentRow[]> {
  const { rows } = await db.query(
    `
      select
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        comment_text as "commentText",
        created_by_user_id as "createdByUserId",
        created_by_name as "createdByName",
        employee_number as "employeeNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from public.comments
      where entity_type = $1
        and entity_id = $2
        and is_deleted = false
      order by created_at desc, id desc
      limit $3
    `,
    [cleanText(entityType), cleanText(entityId), limit]
  );

  return rows as CommentRow[];
}

export async function updateComment(input: UpdateCommentInput): Promise<CommentRow | null> {
  const commentText = cleanText(input.commentText);
  if (!commentText) throw new Error("Comment text is required");

  const { rows } = await db.query(
    `
      update public.comments
      set
        comment_text = $2,
        updated_at = now()
      where id = $1
        and is_deleted = false
      returning
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        comment_text as "commentText",
        created_by_user_id as "createdByUserId",
        created_by_name as "createdByName",
        employee_number as "employeeNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [input.id, commentText]
  );

  return (rows[0] as CommentRow | undefined) ?? null;
}

export async function softDeleteComment(input: DeleteCommentInput): Promise<boolean> {
  const res = await db.query(
    `
      update public.comments
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