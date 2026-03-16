import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  softDeleteComment,
  updateComment,
} from "@/lib/repositories/commentsRepo";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "TECH",
]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function buildActor(auth: ReturnType<typeof getAuthFromRequest>) {
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
  };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!roleOk((auth as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await ctx.params;
    const id = toInt(idStr);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const commentText = String((body as any).commentText || "").trim();
    if (!commentText) {
      return NextResponse.json({ error: "commentText is required" }, { status: 400 });
    }

    const row = await updateComment({ id, commentText });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, row }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update comment" },
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
    if (!roleOk((auth as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await ctx.params;
    const id = toInt(idStr);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const actor = buildActor(auth);
    const ok = await softDeleteComment({
      id,
      deletedByUserId: actor.userId,
      deletedByName: actor.userName,
    });

    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete comment" },
      { status: 500 }
    );
  }
}