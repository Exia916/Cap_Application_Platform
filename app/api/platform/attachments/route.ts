import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createAttachment,
  listAttachmentsByEntity,
} from "@/lib/repositories/attachmentsRepo";
import { saveUploadedFile, canInlineMimeType } from "@/lib/platform/fileStorage";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import {
  canManageOsSecureAttachments,
  isOsSecureAttachmentEntity,
  normalizeAttachmentVisibility,
} from "@/lib/platform/attachmentVisibility";

export const runtime = "nodejs";

function buildActor(auth: ReturnType<typeof getAuthFromRequest>) {
  const rawEmp =
    (auth as any)?.employeeNumber ??
    (auth as any)?.employee_number ??
    null;

  const empNum = Number(rawEmp);

  return {
    userId:
      String(
        (auth as any)?.userId ??
          (auth as any)?.id ??
          (auth as any)?.username ??
          ""
      ).trim() || null,

    userName:
      String(
        (auth as any)?.displayName ??
          (auth as any)?.name ??
          (auth as any)?.username ??
          ""
      ).trim() || null,

    employeeNumber: Number.isFinite(empNum) ? Math.trunc(empNum) : null,

    role: String((auth as any)?.role ?? "").trim().toUpperCase(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const actor = buildActor(auth);

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

    const supportsOsSecureFiles = isOsSecureAttachmentEntity(entityType);
    const canManageOsSecureFiles =
      supportsOsSecureFiles && canManageOsSecureAttachments(actor.role);

    const rows = await listAttachmentsByEntity(entityType, entityId, limit, {
      includeOsSecure: canManageOsSecureFiles,
    });

    const responseRows = rows.map((row) => ({
      ...row,
      canPreviewInline: canInlineMimeType(row.mimeType),
    }));

    return NextResponse.json(
      {
        rows: responseRows,
        supportsOsSecureFiles,
        canManageOsSecureFiles,
      },
      { status: 200 }
    );
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

    const actor = buildActor(auth);

    const form = await req.formData();
    const entityType = String(form.get("entityType") || "").trim();
    const entityId = String(form.get("entityId") || "").trim();
    const attachmentComment = String(form.get("attachmentComment") || "").trim() || null;
    const visibility = normalizeAttachmentVisibility(form.get("visibility"));
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

    if (visibility === "os_secure" && !isOsSecureAttachmentEntity(entityType)) {
      return NextResponse.json(
        { error: "OS Secure Files are only supported for CAP Workflow attachments." },
        { status: 400 }
      );
    }

    if (visibility === "os_secure" && !canManageOsSecureAttachments(actor.role)) {
      return NextResponse.json(
        { error: "Not authorized to upload OS Secure Files." },
        { status: 403 }
      );
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
      visibility,
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
        message:
          row.visibility === "os_secure"
            ? `OS Secure File added: "${row.originalFileName}".`
            : `Attachment added: "${row.originalFileName}".`,
        module: entityType.startsWith("cmms") ? "cmms" : null,
        userId: actor.userId,
        userName: actor.userName,
        employeeNumber: actor.employeeNumber,
        newValue: {
          attachmentId: row.id,
          originalFileName: row.originalFileName,
          visibility: row.visibility,
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