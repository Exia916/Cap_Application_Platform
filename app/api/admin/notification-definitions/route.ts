import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listNotificationDefinitions,
  upsertNotificationDefinition,
} from "@/lib/repositories/notificationDefinitionsRepo";
import { resolveCurrentUserIdentity } from "@/lib/services/currentUserIdentityService";
import type {
  NotificationChannel,
  NotificationPriority,
} from "@/lib/repositories/notificationEventsRepo";

export const runtime = "nodejs";

function roleOf(auth: any) {
  return String(auth?.role ?? "").trim().toUpperCase();
}

function requireAdmin(auth: any) {
  if (!auth) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  if (roleOf(auth) !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const };
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseChannels(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) return ["in_app"];

  const allowed = new Set<NotificationChannel>(["in_app", "email"]);
  const out: NotificationChannel[] = [];

  for (const raw of value) {
    const channel = clean(raw).toLowerCase() as NotificationChannel;
    if (!allowed.has(channel)) continue;
    if (!out.includes(channel)) out.push(channel);
  }

  return out.length ? out : ["in_app"];
}

function parsePriority(value: unknown): NotificationPriority {
  const v = clean(value).toLowerCase();

  if (v === "low" || v === "high" || v === "urgent") {
    return v;
  }

  return "normal";
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    const access = requireAdmin(auth);

    if (!access.ok) {
      return jsonError(access.error, access.status);
    }

    const rows = await listNotificationDefinitions();

    return NextResponse.json({ rows });
  } catch (err: any) {
    return jsonError(err?.message || "Failed to load notification definitions.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    const access = requireAdmin(auth);

    if (!access.ok) {
      return jsonError(access.error, access.status);
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body.", 400);
    }

    const eventType = clean((body as any).eventType);
    const titleTemplate = clean((body as any).titleTemplate);

    if (!eventType) {
      return jsonError("Event type is required.", 400);
    }

    if (!titleTemplate) {
      return jsonError("Title template is required.", 400);
    }

    const identity = await resolveCurrentUserIdentity(auth);

    const row = await upsertNotificationDefinition({
      eventType,
      module: clean((body as any).module) || "platform",
      description: clean((body as any).description) || null,
      isActive: (body as any).isActive !== false,
      defaultPriority: parsePriority((body as any).defaultPriority),
      titleTemplate,
      messageTemplate: clean((body as any).messageTemplate) || null,
      channels: parseChannels((body as any).channels),
      updatedBy: identity.publicUserId,
    });

    return NextResponse.json({ row }, { status: 201 });
  } catch (err: any) {
    return jsonError(err?.message || "Failed to save notification definition.", 500);
  }
}
