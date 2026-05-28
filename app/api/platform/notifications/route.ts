import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  countUnreadNotificationsForUser,
  listNotificationsForUser,
} from "@/lib/repositories/notificationEventsRepo";
import { resolveCurrentUserIdentity } from "@/lib/services/currentUserIdentityService";

export const runtime = "nodejs";

function toLimit(value: unknown, fallback = 50, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function toOffset(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = await resolveCurrentUserIdentity(auth);

  if (!identity.publicUserId) {
    return NextResponse.json(
      { error: "Authenticated user could not be resolved." },
      { status: 400 },
    );
  }

  const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";
  const limit = toLimit(req.nextUrl.searchParams.get("limit"));
  const offset = toOffset(req.nextUrl.searchParams.get("offset"));

  const [rows, unreadCount] = await Promise.all([
    listNotificationsForUser({
      userId: identity.publicUserId,
      unreadOnly,
      limit,
      offset,
    }),
    countUnreadNotificationsForUser(identity.publicUserId),
  ]);

  return NextResponse.json({
    rows,
    unreadCount,
    limit,
    offset,
  });
}