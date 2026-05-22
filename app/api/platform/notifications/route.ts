import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  countUnreadNotificationsForUser,
  listNotificationsForUser,
} from "@/lib/repositories/notificationEventsRepo";

export const runtime = "nodejs";

function getAuthUserId(auth: any): string | null {
  const id = auth?.id;
  return id != null && String(id).trim() ? String(id).trim() : null;
}

function parseBool(value: string | null): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function parseOffset(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = getAuthUserId(auth);

  if (!userId) {
    return NextResponse.json(
      { error: "Unable to identify authenticated user." },
      { status: 400 }
    );
  }

  try {
    const unreadOnly = parseBool(req.nextUrl.searchParams.get("unreadOnly"));
    const limit = parsePositiveInt(req.nextUrl.searchParams.get("limit"), 50, 200);
    const offset = parseOffset(req.nextUrl.searchParams.get("offset"));

    const [rows, unreadCount] = await Promise.all([
      listNotificationsForUser({
        userId,
        unreadOnly,
        limit,
        offset,
      }),
      countUnreadNotificationsForUser(userId),
    ]);

    return NextResponse.json(
      {
        rows,
        unreadCount,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/platform/notifications failed:", err);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to load notifications."
            : err?.message || "Failed to load notifications.",
      },
      { status: 500 }
    );
  }
}