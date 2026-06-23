import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireExternalWorkflowCapability,
  requireExternalWorkflowContext,
} from "@/lib/external-access/requestContext";
import { getPartnerVisibleWorkflowRequestById } from "@/lib/repositories/designWorkflowExternalRepo";
import {
  createAttachment,
  listAttachmentsByEntity,
  normalizeAttachmentCategory,
} from "@/lib/repositories/attachmentsRepo";
import { saveUploadedFile, canInlineMimeType } from "@/lib/platform/fileStorage";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";

export const runtime = "nodejs";

const dbQuery = db.query.bind(db);
const WORKFLOW_ENTITY_TYPE = "design_workflow";

async function requireVisibleRecord(partner: any, requestId: string) {
  const record = await getPartnerVisibleWorkflowRequestById(dbQuery, partner, requestId);
  return record;
}

function actorPayload(access: any) {
  return {
    userId: access.context.userId,
    userName:
      access.context.actorName ??
      access.context.partner.externalPartnerName ??
      "External Partner",
    employeeNumber: access.context.employeeNumber ?? null,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const capabilityBlock = requireExternalWorkflowCapability(access.context.partner, "canDownload");
  if (capabilityBlock) return capabilityBlock;

  const { id } = await context.params;

  try {
    const record = await requireVisibleRecord(access.context.partner, id);
    if (!record) {
      return NextResponse.json({ error: "Workflow record not found." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const attachmentCategory = normalizeAttachmentCategory(
      searchParams.get("attachmentCategory") ?? searchParams.get("category"),
    );
    const limitRaw = Number.parseInt(String(searchParams.get("limit") || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    const rows = await listAttachmentsByEntity(WORKFLOW_ENTITY_TYPE, id, limit, {
      includeOsSecure: false,
      attachmentCategory,
    });

    return NextResponse.json({
      rows: rows.map((row) => ({
        ...row,
        canPreviewInline: canInlineMimeType(row.mimeType),
        openUrl: `/api/partner-work/workflow/${encodeURIComponent(id)}/attachments/${row.id}`,
        downloadUrl: `/api/partner-work/workflow/${encodeURIComponent(id)}/attachments/${row.id}?action=download`,
      })),
      supportsOsSecureFiles: true,
      canManageOsSecureFiles: false,
      attachmentCategory,
    });
  } catch (err: any) {
    console.error("GET /api/partner-work/workflow/[id]/attachments failed:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to load partner attachments." },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const capabilityBlock = requireExternalWorkflowCapability(access.context.partner, "canUpload");
  if (capabilityBlock) return capabilityBlock;

  const { id } = await context.params;

  try {
    const record = await requireVisibleRecord(access.context.partner, id);
    if (!record) {
      return NextResponse.json({ error: "Workflow record not found." }, { status: 404 });
    }

    const actor = actorPayload(access);
    const form = await req.formData();
    const attachmentCategory = normalizeAttachmentCategory(
      form.get("attachmentCategory") ?? form.get("category"),
    );
    const attachmentComment = String(form.get("attachmentComment") || "").trim() || null;
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const arr = await file.arrayBuffer();
    const bytes = Buffer.from(arr);

    const stored = await saveUploadedFile({
      entityType: WORKFLOW_ENTITY_TYPE,
      entityId: id,
      originalFileName: file.name,
      mimeType: file.type || null,
      bytes,
    });

    const row = await createAttachment({
      entityType: WORKFLOW_ENTITY_TYPE,
      entityId: id,
      attachmentCategory,
      originalFileName: stored.originalFileName,
      storedFileName: stored.storedFileName,
      storedRelativePath: stored.storedRelativePath,
      storageProvider: "s3",
      bucketName: stored.bucketName,
      objectKey: stored.objectKey,
      objectVersionId: stored.objectVersionId,
      attachmentComment:
        attachmentComment ??
        `Uploaded by external partner ${access.context.partner.externalPartnerName}.`,
      visibility: "standard",
      mimeType: file.type || null,
      fileSizeBytes: stored.fileSizeBytes,
      uploadedByUserId: actor.userId,
      uploadedByName: actor.userName,
      employeeNumber: actor.employeeNumber,
    });

    try {
      await createActivityHistory({
        entityType: WORKFLOW_ENTITY_TYPE,
        entityId: id,
        eventType: "attachment_added",
        fieldName: "attachment",
        message: `External partner attachment added: "${row.originalFileName}".`,
        module: "design_workflow",
        userId: actor.userId,
        userName: actor.userName,
        employeeNumber: actor.employeeNumber,
        newValue: {
          attachmentId: row.id,
          originalFileName: row.originalFileName,
          attachmentCategory: row.attachmentCategory,
          visibility: row.visibility,
          mimeType: row.mimeType,
          fileSizeBytes: row.fileSizeBytes,
          attachmentComment: row.attachmentComment,
          storageProvider: row.storageProvider,
          objectKey: row.objectKey,
          externalPartnerId: access.context.partner.externalPartnerId,
          externalPartnerCode: access.context.partner.externalPartnerCode,
        },
      });
    } catch {
      // Do not fail upload if history logging fails.
    }

    return NextResponse.json(
      {
        ok: true,
        row: {
          ...row,
          canPreviewInline: canInlineMimeType(row.mimeType),
          openUrl: `/api/partner-work/workflow/${encodeURIComponent(id)}/attachments/${row.id}`,
          downloadUrl: `/api/partner-work/workflow/${encodeURIComponent(id)}/attachments/${row.id}?action=download`,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("POST /api/partner-work/workflow/[id]/attachments failed:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to upload partner attachment." },
      { status: 500 },
    );
  }
}
