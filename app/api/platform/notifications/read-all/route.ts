import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  countUnreadNotificationsForUser,
  markAllNotificationsRead,
} from "@/lib/repositories/notificationEventsRepo";

export const runtime = "nodejs";

function getAuthUserId(auth: any): string | null {
  const id = auth?.id;
  return id != null && String(id).trim() ? String(id).trim() : null;
}

export async function PATCH(req: NextRequest) {
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
    const result = await markAllNotificationsRead({ userId });
    const unreadCount = await countUnreadNotificationsForUser(userId);

    return NextResponse.json(
      {
        success: true,
        updatedCount: result.updatedCount,
        unreadCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("PATCH /api/platform/notifications/read-all failed:", err);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to mark notifications as read."
            : err?.message || "Failed to mark notifications as read.",
      },
      { status: 500 }
    );
  }
}