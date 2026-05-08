import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getAttachmentById,
  softDeleteAttachment,
  updateAttachment,
  type UpdateAttachmentInput,
} from "@/lib/repositories/attachmentsRepo";
import {
  canInlineMimeType,
  getPresignedReadUrl,
  getPresignedUrlTtlSeconds,
} from "@/lib/platform/fileStorage";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import {
  canManageOsSecureAttachments,
  isOsSecureAttachmentEntity,
  isOsSecureVisibility,
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

function parseId(raw: string): number | null {
  const id = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function canAccessAttachmentContent(input: {
  visibility?: string | null;
  role?: string | null;
}) {
  if (!isOsSecureVisibility(input.visibility)) return true;
  return canManageOsSecureAttachments(input.role);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const actor = buildActor(auth);

    const params = await Promise.resolve(ctx.params);
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({ error: "Invalid attachment id" }, { status: 400 });
    }

    const row = await getAttachmentById(id);
    if (!row) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (!canAccessAttachmentContent({ visibility: row.visibility, role: actor.role })) {
      return NextResponse.json(
        { error: "Not authorized to access this attachment." },
        { status: 403 }
      );
    }

    if (!row.bucketName || !row.objectKey) {
      return NextResponse.json(
        { error: "Attachment storage metadata is incomplete." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = String(searchParams.get("action") || "open").trim().toLowerCase();
    const wantsDownload = action === "download" || searchParams.get("download") === "1";
    const wantsShare = action === "share";
    const wantsMeta = action === "meta";

    if (wantsShare && row.visibility === "os_secure") {
      return NextResponse.json(
        { error: "OS Secure Files cannot be shared by link." },
        { status: 403 }
      );
    }

    const ttlSeconds = getPresignedUrlTtlSeconds();
    const inline = canInlineMimeType(row.mimeType);
    const disposition: "inline" | "attachment" =
      wantsDownload ? "attachment" : inline ? "inline" : "attachment";

    const url = await getPresignedReadUrl({
      bucketName: row.bucketName,
      objectKey: row.objectKey,
      originalFileName: row.originalFileName,
      mimeType: row.mimeType,
      disposition,
      expiresInSeconds: ttlSeconds,
    });

    if (wantsShare || wantsMeta) {
      return NextResponse.json(
        {
          row: { ...row, canPreviewInline: inline },
          action: wantsShare ? "share" : "meta",
          url,
          expiresInSeconds: ttlSeconds,
          canPreviewInline: inline,
        },
        { status: 200 }
      );
    }

    return NextResponse.redirect(url, { status: 302 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to open attachment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const actor = buildActor(auth);

    const params = await Promise.resolve(ctx.params);
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({ error: "Invalid attachment id" }, { status: 400 });
    }

    const before = await getAttachmentById(id);
    if (!before) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (!canAccessAttachmentContent({ visibility: before.visibility, role: actor.role })) {
      return NextResponse.json(
        { error: "Not authorized to update this attachment." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const hasAttachmentComment = Object.prototype.hasOwnProperty.call(
      body,
      "attachmentComment"
    );

    const hasVisibility = Object.prototype.hasOwnProperty.call(body, "visibility");

    const updateInput: UpdateAttachmentInput = { id };

    if (hasAttachmentComment) {
      updateInput.attachmentComment =
        String((body as any)?.attachmentComment ?? "").trim() || null;
    }

    if (hasVisibility) {
      const requestedVisibility = normalizeAttachmentVisibility((body as any)?.visibility);

      if (!isOsSecureAttachmentEntity(before.entityType)) {
        return NextResponse.json(
          { error: "OS Secure Files are only supported for CAP Workflow attachments." },
          { status: 400 }
        );
      }

      if (!canManageOsSecureAttachments(actor.role)) {
        return NextResponse.json(
          { error: "Not authorized to update OS Secure File visibility." },
          { status: 403 }
        );
      }

      updateInput.visibility = requestedVisibility;
    }

    const row = await updateAttachment(updateInput);
    if (!row) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    try {
      await createActivityHistory({
        entityType: row.entityType,
        entityId: row.entityId,
        eventType: "attachment_updated",
        fieldName:
          hasVisibility && hasAttachmentComment
            ? "attachment"
            : hasVisibility
              ? "attachment_visibility"
              : "attachment_comment",
        message: `Attachment updated: "${row.originalFileName}".`,
        module: row.entityType.startsWith("cmms") ? "cmms" : null,
        userId: actor.userId,
        userName: actor.userName,
        employeeNumber: actor.employeeNumber,
        previousValue: {
          attachmentComment: before.attachmentComment,
          visibility: before.visibility,
        },
        newValue: {
          attachmentComment: row.attachmentComment,
          visibility: row.visibility,
        },
      });
    } catch {
      // do not fail update if history logging fails
    }

    return NextResponse.json(
      { ok: true, row: { ...row, canPreviewInline: canInlineMimeType(row.mimeType) } },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update attachment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const actor = buildActor(auth);

    const params = await Promise.resolve(ctx.params);
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({ error: "Invalid attachment id" }, { status: 400 });
    }

    const row = await getAttachmentById(id);
    if (!row) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (!canAccessAttachmentContent({ visibility: row.visibility, role: actor.role })) {
      return NextResponse.json(
        { error: "Not authorized to remove this attachment." },
        { status: 403 }
      );
    }

    const ok = await softDeleteAttachment({
      id,
      deletedByUserId: actor.userId,
      deletedByName: actor.userName,
    });

    if (!ok) {
      return NextResponse.json(
        { error: "Attachment was already deleted" },
        { status: 409 }
      );
    }

    try {
      await createActivityHistory({
        entityType: row.entityType,
        entityId: row.entityId,
        eventType: "attachment_removed",
        fieldName: "attachment",
        message: `Attachment removed: "${row.originalFileName}".`,
        module: row.entityType.startsWith("cmms") ? "cmms" : null,
        userId: actor.userId,
        userName: actor.userName,
        employeeNumber: actor.employeeNumber,
        previousValue: {
          attachmentId: row.id,
          originalFileName: row.originalFileName,
          visibility: row.visibility,
          attachmentComment: row.attachmentComment,
          objectKey: row.objectKey,
        },
      });
    } catch {
      // do not fail delete if history logging fails
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to remove attachment" },
      { status: 500 }
    );
  }
}