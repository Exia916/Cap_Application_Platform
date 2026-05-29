import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getPlatformEventTypeById,
  setPlatformEventTypeActive,
  updatePlatformEventType,
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

  if (raw.toLowerCase().includes("foreign key")) {
    return "This event type is already in use and cannot be changed in that way.";
  }

  if (
    raw.toLowerCase().includes("duplicate") ||
    raw.toLowerCase().includes("unique")
  ) {
    return "That event type already exists.";
  }

  return process.env.NODE_ENV === "production" ? fallback : raw || fallback;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    const row = await getPlatformEventTypeById(id);
    if (!row) {
      return NextResponse.json({ error: "Event type not found." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    console.error(`GET /api/platform/event-types/${id} failed:`, err);
    return NextResponse.json(
      { error: errorMessage(err, "Failed to load event type.") },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const row = await updatePlatformEventType({
      id,
      eventLabel: body.eventLabel,
      eventDescription: body.eventDescription,
      eventGroup: body.eventGroup,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
      updatedBy: currentUserId(access.auth),
    });

    if (!row) {
      return NextResponse.json({ error: "Event type not found." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    console.error(`PUT /api/platform/event-types/${id} failed:`, err);

    const msg = errorMessage(err, "Failed to update event type.");
    const status = msg.includes("required") || msg.includes("may only") ? 400 : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    const row = await setPlatformEventTypeActive({
      id,
      isActive: false,
      updatedBy: currentUserId(access.auth),
    });

    if (!row) {
      return NextResponse.json({ error: "Event type not found." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    console.error(`DELETE /api/platform/event-types/${id} failed:`, err);
    return NextResponse.json(
      { error: errorMessage(err, "Failed to deactivate event type.") },
      { status: 500 }
    );
  }
}