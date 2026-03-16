import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createComment,
  listCommentsByEntity,
} from "@/lib/repositories/commentsRepo";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "TECH",
  "WAREHOUSE",
  "USER",
  "OPERATOR",
]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

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
    if (!roleOk((auth as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const rows = await listCommentsByEntity(entityType, entityId, limit);
    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load comments" },
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
    if (!roleOk((auth as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const entityType = String((body as any).entityType || "").trim();
    const entityId = String((body as any).entityId || "").trim();
    const commentText = String((body as any).commentText || "").trim();

    if (!entityType || !entityId || !commentText) {
      return NextResponse.json(
        { error: "entityType, entityId, and commentText are required" },
        { status: 400 }
      );
    }

    const actor = buildActor(auth);

    const row = await createComment({
      entityType,
      entityId,
      commentText,
      createdByUserId: actor.userId,
      createdByName: actor.userName,
      employeeNumber: actor.employeeNumber,
    });

    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create comment" },
      { status: 500 }
    );
  }
}