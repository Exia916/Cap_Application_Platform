import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireExternalWorkflowCapability,
  requireExternalWorkflowContext,
} from "@/lib/external-access/requestContext";
import { getPartnerVisibleWorkflowRequestById } from "@/lib/repositories/designWorkflowExternalRepo";
import { getAttachmentById } from "@/lib/repositories/attachmentsRepo";
import {
  canInlineMimeType,
  getPresignedReadUrl,
  getPresignedUrlTtlSeconds,
} from "@/lib/platform/fileStorage";

export const runtime = "nodejs";

const dbQuery = db.query.bind(db);
const WORKFLOW_ENTITY_TYPE = "design_workflow";

function parseAttachmentId(raw: unknown): number | null {
  const id = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const capabilityBlock = requireExternalWorkflowCapability(access.context.partner, "canDownload");
  if (capabilityBlock) return capabilityBlock;

  const { id, attachmentId } = await context.params;

  try {
    const record = await getPartnerVisibleWorkflowRequestById(
      dbQuery,
      access.context.partner,
      id,
    );

    if (!record) {
      return NextResponse.json({ error: "Workflow record not found." }, { status: 404 });
    }

    const parsedAttachmentId = parseAttachmentId(attachmentId);
    if (!parsedAttachmentId) {
      return NextResponse.json({ error: "Invalid attachment id." }, { status: 400 });
    }

    const row = await getAttachmentById(parsedAttachmentId);
    if (!row) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    if (row.entityType !== WORKFLOW_ENTITY_TYPE || row.entityId !== id) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    if (row.visibility === "os_secure") {
      return NextResponse.json(
        { error: "Not authorized to access OS Secure files." },
        { status: 403 },
      );
    }

    if (!row.bucketName || !row.objectKey) {
      return NextResponse.json(
        { error: "Attachment storage metadata is incomplete." },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);
    const action = String(searchParams.get("action") || "open").trim().toLowerCase();
    const wantsDownload = action === "download" || searchParams.get("download") === "1";
    const wantsMeta = action === "meta";

    const inline = canInlineMimeType(row.mimeType);
    const ttlSeconds = getPresignedUrlTtlSeconds();
    const disposition: "inline" | "attachment" = wantsDownload ? "attachment" : inline ? "inline" : "attachment";

    const url = await getPresignedReadUrl({
      bucketName: row.bucketName,
      objectKey: row.objectKey,
      originalFileName: row.originalFileName,
      mimeType: row.mimeType,
      disposition,
      expiresInSeconds: ttlSeconds,
    });

    if (wantsMeta) {
      return NextResponse.json(
        {
          row: { ...row, canPreviewInline: inline },
          action: "meta",
          url,
          expiresInSeconds: ttlSeconds,
          canPreviewInline: inline,
        },
        { status: 200 },
      );
    }

    return NextResponse.redirect(url, { status: 302 });
  } catch (err: any) {
    console.error("GET /api/partner-work/workflow/[id]/attachments/[attachmentId] failed:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to open partner attachment." },
      { status: 500 },
    );
  }
}
