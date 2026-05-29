import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createPlatformEventType,
  listPlatformEventTypes,
} from "@/lib/repositories/platformEventTypesRepo";

export const runtime = "nodejs";

function requirePlatformAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const role = String(auth.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, auth };
}

function currentUserId(auth: any): string | null {
  return auth?.id ? String(auth.id) : null;
}

function errorMessage(err: any, fallback: string) {
  const raw = String(err?.message || "");

  if (
    raw.toLowerCase().includes("duplicate") ||
    raw.toLowerCase().includes("unique")
  ) {
    return "That event type already exists.";
  }

  return process.env.NODE_ENV === "production" ? fallback : raw || fallback;
}

export async function GET(req: NextRequest) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const sp = req.nextUrl.searchParams;

  try {
    const rows = await listPlatformEventTypes({
      q: sp.get("q"),
      module: sp.get("module"),
      eventGroup: sp.get("eventGroup"),
      activeOnly: sp.get("activeOnly") === "true",
    });

    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error("GET /api/platform/event-types failed:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Failed to load event types.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const row = await createPlatformEventType({
      module: body.module,
      eventType: body.eventType,
      eventLabel: body.eventLabel,
      eventDescription: body.eventDescription,
      eventGroup: body.eventGroup,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
      createdBy: currentUserId(access.auth),
      updatedBy: currentUserId(access.auth),
    });

    return NextResponse.json({ row }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/platform/event-types failed:", err);

    const msg = errorMessage(err, "Failed to create event type.");
    const status = msg.includes("required") || msg.includes("may only") ? 400 : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}