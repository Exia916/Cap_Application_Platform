import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getNotificationDefinitionById,
  updateNotificationDefinitionById,
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

function parseChannels(value: unknown): NotificationChannel[] | undefined {
  if (value === undefined) return undefined;
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

function parsePriority(value: unknown): NotificationPriority | undefined {
  if (value === undefined) return undefined;

  const v = clean(value).toLowerCase();

  if (v === "low" || v === "high" || v === "urgent") {
    return v;
  }

  return "normal";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthFromRequest(req);
    const access = requireAdmin(auth);

    if (!access.ok) {
      return jsonError(access.error, access.status);
    }

    const { id } = await ctx.params;
    const row = await getNotificationDefinitionById(id);

    if (!row) {
      return jsonError("Notification definition was not found.", 404);
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    return jsonError(err?.message || "Failed to load notification definition.", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthFromRequest(req);
    const access = requireAdmin(auth);

    if (!access.ok) {
      return jsonError(access.error, access.status);
    }

    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body.", 400);
    }

    const identity = await resolveCurrentUserIdentity(auth);

    const row = await updateNotificationDefinitionById({
      id,
      module:
        (body as any).module === undefined
          ? undefined
          : clean((body as any).module) || "platform",
      description:
        (body as any).description === undefined
          ? undefined
          : clean((body as any).description) || null,
      isActive:
        (body as any).isActive === undefined
          ? undefined
          : !!(body as any).isActive,
      defaultPriority: parsePriority((body as any).defaultPriority),
      titleTemplate:
        (body as any).titleTemplate === undefined
          ? undefined
          : clean((body as any).titleTemplate),
      messageTemplate:
        (body as any).messageTemplate === undefined
          ? undefined
          : clean((body as any).messageTemplate) || null,
      channels: parseChannels((body as any).channels),
      updatedBy: identity.publicUserId,
    });

    if (!row) {
      return jsonError("Notification definition was not found.", 404);
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    return jsonError(err?.message || "Failed to update notification definition.", 500);
  }
}
