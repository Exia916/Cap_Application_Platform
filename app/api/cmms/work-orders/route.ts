import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { createWorkOrder, listWorkOrdersPaged } from "@/lib/repositories/cmmsRepo";

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

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!roleOk((auth as any).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);

    const pageIndex = Math.max(0, Number(url.searchParams.get("pageIndex") || "0") || 0);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || "25") || 25, 1), 250);

    const sortBy = (url.searchParams.get("sortBy") || "requestedAt").trim();
    const sortDir = (url.searchParams.get("sortDir") || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";

    const requestedFrom = (url.searchParams.get("requestedFrom") || "").trim() || undefined;
    const requestedTo = (url.searchParams.get("requestedTo") || "").trim() || undefined;

    const filters: Record<string, string> = {};
    for (const [k, v] of url.searchParams.entries()) {
      if (k.startsWith("f_") && v.trim()) filters[k.slice(2)] = v.trim();
    }

    const data = await listWorkOrdersPaged({
      pageIndex,
      pageSize,
      sortBy,
      sortDir,
      filters,
      requestedFrom,
      requestedTo,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    console.error("CMMS GET /work-orders failed:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load work orders", code: e?.code, detail: e?.detail },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!roleOk((auth as any).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Coerce IDs safely (dropdowns often send strings)
    const departmentId = toInt((body as any).departmentId);
    const assetId = toInt((body as any).assetId);
    const priorityId = toInt((body as any).priorityId);
    const commonIssueId = toInt((body as any).commonIssueId);
    const operatorInitials = String((body as any).operatorInitials || "").trim() || null;
    const issueDialogue = String((body as any).issueDialogue || "").trim();

    // Validate required
    const missing: string[] = [];
    if (!departmentId) missing.push("departmentId");
    if (!assetId) missing.push("assetId");
    if (!priorityId) missing.push("priorityId");
    if (!commonIssueId) missing.push("commonIssueId");
    if (!issueDialogue) missing.push("issueDialogue");

    if (missing.length) {
      return NextResponse.json({ error: `Missing/invalid fields: ${missing.join(", ")}` }, { status: 400 });
    }

    // ✅ Bulletproof requester identity fields (prevents blank names)
    const requestedByUserId = (auth as any).userId ?? (auth as any).id ?? null;
    const requestedByName =
      String((auth as any).displayName ?? (auth as any).name ?? (auth as any).username ?? "").trim() || "Unknown";

    const result = await createWorkOrder({
      requestedByUserId,
      requestedByName,
      departmentId,
      assetId,
      priorityId,
      commonIssueId,
      operatorInitials,
      issueDialogue,
    });

    return NextResponse.json({ ok: true, workOrderId: result.workOrderId }, { status: 201 });
  } catch (e: any) {
    console.error("CMMS POST /work-orders failed:", e);

    const msg = e?.detail ? `${e?.message || "Create failed"} — ${e.detail}` : e?.message || "Create failed";
    return NextResponse.json({ error: msg, code: e?.code, detail: e?.detail }, { status: 500 });
  }
}