import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createAttachment,
  listAttachmentsByEntity,
} from "@/lib/repositories/attachmentsRepo";
import { saveUploadedFile, canInlineMimeType } from "@/lib/platform/fileStorage";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";

export const runtime = "nodejs";

function buildActor(auth: ReturnType<typeof getAuthFromRequest>) {
  const rawEmp =
    (auth as any)?.employeeNumber ??
    (auth as any)?.employee_number ??
    null;

  const empNum = Number(rawEmp);

  return {
    userId: String(
      (auth as any)?.userId ??
        (auth as any)?.id ??
        (auth as any)?.username ??
        ""
    ).trim() || null,

    userName: String(
      (auth as any)?.displayName ??
        (auth as any)?.name ??
        (auth as any)?.username ??
        ""
    ).trim() || null,

    employeeNumber: Number.isFinite(empNum) ? Math.trunc(empNum) : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entityType = String(searchParams.get("entityType") || "").trim();
    const entityId = String(searchParams.get("entityId") || "").trim();
    const limitRaw = Number.parseInt(String(searchParams.get("limit") || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    const rows = await listAttachmentsByEntity(entityType, entityId, limit);

    const responseRows = rows.map((row) => ({
      ...row,
      canPreviewInline: canInlineMimeType(row.mimeType),
    }));

    return NextResponse.json({ rows: responseRows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load attachments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const form = await req.formData();
    const entityType = String(form.get("entityType") || "").trim();
    const entityId = String(form.get("entityId") || "").trim();
    const attachmentComment = String(form.get("attachmentComment") || "").trim() || null;
    const file = form.get("file");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const arr = await file.arrayBuffer();
    const bytes = Buffer.from(arr);

    const stored = await saveUploadedFile({
      entityType,
      entityId,
      originalFileName: file.name,
      mimeType: file.type || null,
      bytes,
    });

    const actor = buildActor(auth);

    const row = await createAttachment({
      entityType,
      entityId,
      originalFileName: stored.originalFileName,
      storedFileName: stored.storedFileName,
      storedRelativePath: stored.storedRelativePath,
      storageProvider: "s3",
      bucketName: stored.bucketName,
      objectKey: stored.objectKey,
      objectVersionId: stored.objectVersionId,
      attachmentComment,
      mimeType: file.type || null,
      fileSizeBytes: stored.fileSizeBytes,
      uploadedByUserId: actor.userId,
      uploadedByName: actor.userName,
      employeeNumber: actor.employeeNumber,
    });

    try {
      await createActivityHistory({
        entityType,
        entityId,
        eventType: "attachment_added",
        fieldName: "attachment",
        message: `Attachment added: "${row.originalFileName}".`,
        module: entityType.startsWith("cmms") ? "cmms" : null,
        userId: actor.userId,
        userName: actor.userName,
        employeeNumber: actor.employeeNumber,
        newValue: {
          attachmentId: row.id,
          originalFileName: row.originalFileName,
          mimeType: row.mimeType,
          fileSizeBytes: row.fileSizeBytes,
          attachmentComment: row.attachmentComment,
          storageProvider: row.storageProvider,
          objectKey: row.objectKey,
        },
      });
    } catch {
      // do not fail upload if history logging fails
    }

    return NextResponse.json(
      { ok: true, row: { ...row, canPreviewInline: canInlineMimeType(row.mimeType) } },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
