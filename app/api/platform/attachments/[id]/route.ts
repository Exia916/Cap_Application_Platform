import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getAttachmentById,
  softDeleteAttachment,
} from "@/lib/repositories/attachmentsRepo";
import {
  deleteStoredFile,
  getStoredAbsolutePath,
  canInlineMimeType,
} from "@/lib/platform/fileStorage";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";

export const runtime = "nodejs";

const VIEW_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "TECH",
  "WAREHOUSE",
  "USER",
  "OPERATOR",
]);

const DELETE_ROLES = new Set([
  "ADMIN",
//   "MANAGER",
//   "SUPERVISOR",
]);

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

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
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!VIEW_ROLES.has(String((auth as any)?.role || "").trim().toUpperCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await ctx.params;
    const id = toInt(idStr);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = await getAttachmentById(id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const absolutePath = await getStoredAbsolutePath(row.storedRelativePath);
    const fileBytes = await readFile(absolutePath);

    const mode = String(new URL(req.url).searchParams.get("mode") || "").trim().toLowerCase();
    const inlineAllowed = canInlineMimeType(row.mimeType);
    const dispositionType = mode === "download" || !inlineAllowed ? "attachment" : "inline";

    return new NextResponse(fileBytes, {
      status: 200,
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Content-Length": String(fileBytes.length),
        "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(row.originalFileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to download attachment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!DELETE_ROLES.has(String((auth as any)?.role || "").trim().toUpperCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await ctx.params;
    const id = toInt(idStr);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = await getAttachmentById(id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const actor = buildActor(auth);
    const ok = await softDeleteAttachment({
      id,
      deletedByUserId: actor.userId,
      deletedByName: actor.userName,
    });

    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteStoredFile(row.storedRelativePath);

    try {
      await createActivityHistory({
        entityType: row.entityType,
        entityId: row.entityId,
        eventType: "attachment_deleted",
        fieldName: "attachment",
        message: `Attachment deleted: "${row.originalFileName}".`,
        module: row.entityType.startsWith("cmms") ? "cmms" : null,
        userId: actor.userId,
        userName: actor.userName,
        employeeNumber: actor.employeeNumber,
        previousValue: {
          attachmentId: row.id,
          originalFileName: row.originalFileName,
          mimeType: row.mimeType,
          fileSizeBytes: row.fileSizeBytes,
        },
      });
    } catch {
      // do not fail delete if history logging fails
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete attachment" },
      { status: 500 }
    );
  }
}