import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import {
  duplicateRequest,
  getNextSuggestedSalesOrderNumber,
  getRequestById,
} from "@/lib/repositories/designWorkflowRepo";
import {
  listAttachmentsByEntity,
  createAttachment,
} from "@/lib/repositories/attachmentsRepo";
import { copyStoredFileToEntity } from "@/lib/platform/fileStorage";

export const runtime = "nodejs";

const FULL_ACCESS_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "CUSTOMER SERVICE",
  "PURCHASING",
  "OVERSEAS CUSTOMER SERVICE",
]);

function buildActor(auth: any) {
  const rawEmp = auth?.employeeNumber ?? auth?.employee_number ?? null;
  const empNum = Number(rawEmp);

  return {
    userId:
      String(auth?.userId ?? auth?.id ?? auth?.username ?? "").trim() || null,
    userName:
      String(auth?.displayName ?? auth?.name ?? auth?.username ?? "").trim() ||
      null,
    employeeNumber: Number.isFinite(empNum) ? Math.trunc(empNum) : null,
    role: String(auth?.role ?? "")
      .trim()
      .toUpperCase(),
  };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const auth = getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const actor = buildActor(auth);

    if (!FULL_ACCESS_ROLES.has(actor.role)) {
      return NextResponse.json(
        { error: "Not authorized to duplicate design requests." },
        { status: 403 },
      );
    }

    const params = await Promise.resolve(ctx.params);
    const sourceRequestId = String(params.id || "").trim();

    if (!sourceRequestId) {
      return NextResponse.json(
        { error: "Request id is required." },
        { status: 400 },
      );
    }

    const dbQuery = db.query.bind(db);

    const nextSalesOrderNumber = await getNextSuggestedSalesOrderNumber(dbQuery);

const copied = await duplicateRequest(dbQuery, {
  sourceRequestId,
  createdByUserId: actor.userId,
  createdByName: actor.userName,
  createdBy: actor.userName,
  requestNumber: `DW-${Date.now()}`,
  salesOrderNumber: nextSalesOrderNumber,
  nowIso: new Date().toISOString(),
});

    const sourceAttachments = await listAttachmentsByEntity(
      "design_workflow",
      sourceRequestId,
      500,
    );

    let copiedAttachmentCount = 0;

    for (const attachment of sourceAttachments) {
      const sourceObjectKey =
        String((attachment as any).objectKey || "").trim() ||
        String(attachment.storedRelativePath || "").trim();

      if (!sourceObjectKey) continue;

      const stored = await copyStoredFileToEntity({
        sourceBucketName: (attachment as any).bucketName ?? null,
        sourceObjectKey,
        entityType: "design_workflow",
        entityId: copied.id,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType ?? null,
      });

      await createAttachment({
        entityType: "design_workflow",
        entityId: copied.id,
        originalFileName: stored.originalFileName,
        storedFileName: stored.storedFileName,
        storedRelativePath: stored.storedRelativePath,
        storageProvider: "s3",
        bucketName: stored.bucketName,
        objectKey: stored.objectKey,
        objectVersionId: stored.objectVersionId,
        attachmentComment: (attachment as any).attachmentComment ?? null,
        mimeType: attachment.mimeType ?? null,
        fileSizeBytes: attachment.fileSizeBytes ?? stored.fileSizeBytes,
        uploadedByUserId: actor.userId,
        uploadedByName: actor.userName,
        employeeNumber: actor.employeeNumber,
      });

      copiedAttachmentCount += 1;
    }

    const fresh = await getRequestById(dbQuery, copied.id, {
      includeVoided: true,
    });
    const responseRequest = fresh ?? copied;

    return NextResponse.json(
      {
        ok: true,
        id: responseRequest.id,
        request: responseRequest,
        row: responseRequest,
        copiedAttachmentCount,
      },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to duplicate design request." },
      { status: 500 },
    );
  }
}