import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  countUnreadNotificationsForUser,
  markNotificationRead,
} from "@/lib/repositories/notificationEventsRepo";

export const runtime = "nodejs";

function getAuthUserId(auth: any): string | null {
  const id = auth?.id;
  return id != null && String(id).trim() ? String(id).trim() : null;
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(_req as any);

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

  const { id } = await params;
  const deliveryId = String(id ?? "").trim();

  if (!deliveryId) {
    return NextResponse.json({ error: "Missing notification id." }, { status: 400 });
  }

  try {
    const row = await markNotificationRead({
      deliveryId,
      userId,
    });

    if (!row) {
      return NextResponse.json(
        { error: "Notification was not found." },
        { status: 404 }
      );
    }

    const unreadCount = await countUnreadNotificationsForUser(userId);

    return NextResponse.json(
      {
        row,
        unreadCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("PATCH /api/platform/notifications/[id]/read failed:", err);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to mark notification as read."
            : err?.message || "Failed to mark notification as read.",
      },
      { status: 500 }
    );
  }
}