import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/repositories/notificationEventsRepo";
import { resolveCurrentUserIdentity } from "@/lib/services/currentUserIdentityService";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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

  const result = await markAllNotificationsRead({
    userId: identity.publicUserId,
  });

  return NextResponse.json(result);
}