// app/api/cmms/work-orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getWorkOrderById, updateWorkOrderRequesterFields } from "@/lib/repositories/cmmsRepo";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "TECH"]);
function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").toUpperCase());
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!roleOk((auth as any).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idStr } = await ctx.params; // ✅ FIX
    const id = toInt(idStr);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const row = await getWorkOrderById(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(row, { status: 200 });
  } catch (e: any) {
    console.error("CMMS GET /work-orders/[id] failed:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load work order", code: e?.code, detail: e?.detail },
      { status: 500 }
    );
  }
}

// requester edits only (protect tech fields)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!roleOk((auth as any).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idStr } = await ctx.params; // ✅ FIX
    const id = toInt(idStr);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const departmentId = toInt((body as any).departmentId);
    const assetId = toInt((body as any).assetId);
    const priorityId = toInt((body as any).priorityId);
    const commonIssueId = toInt((body as any).commonIssueId);
    const operatorInitials = String((body as any).operatorInitials || "").trim() || null;
    const issueDialogue = String((body as any).issueDialogue || "").trim();

    const missing: string[] = [];
    if (!departmentId) missing.push("departmentId");
    if (!assetId) missing.push("assetId");
    if (!priorityId) missing.push("priorityId");
    if (!commonIssueId) missing.push("commonIssueId");
    if (!issueDialogue) missing.push("issueDialogue");
    if (missing.length) {
      return NextResponse.json({ error: `Missing/invalid fields: ${missing.join(", ")}` }, { status: 400 });
    }

    const updated = await updateWorkOrderRequesterFields({
      id,
      departmentId,
      assetId,
      priorityId,
      commonIssueId,
      operatorInitials,
      issueDialogue,
    });

    return NextResponse.json({ ok: true, workOrderId: updated.workOrderId }, { status: 200 });
  } catch (e: any) {
    console.error("CMMS PATCH /work-orders/[id] failed:", e);
    const msg = e?.detail ? `${e?.message || "Update failed"} — ${e.detail}` : e?.message || "Update failed";
    return NextResponse.json({ error: msg, code: e?.code, detail: e?.detail }, { status: 500 });
  }
}