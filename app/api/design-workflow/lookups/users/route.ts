import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listAssignableUsers } from "@/lib/repositories/assignableUsersRepo";
import { rejectExternalUserForInternalApi } from "@/lib/external-access/routeGuards";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const externalBlock = await rejectExternalUserForInternalApi(user);
  if (externalBlock) return externalBlock;

  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() || null;
    const department = req.nextUrl.searchParams.get("department")?.trim() || null;

    const rows = await listAssignableUsers({
      q,
      department,
      limit: 100,
    });

    // Preserve the existing Design Workflow lookup shape.
    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        name: row.displayName,
        username: row.username,
        role: row.role,
        employeeNumber: row.employeeNumber,
        shift: row.shift,
        department: row.department,

        // Additive fields for future use. Existing consumers can ignore these.
        email: row.email,
        managerUserId: row.managerUserId,
        managerDisplayName: row.managerDisplayName,
        emailNotificationsEnabled: row.emailNotificationsEnabled,
        inAppNotificationsEnabled: row.inAppNotificationsEnabled,
      }))
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load users lookup." },
      { status: 500 }
    );
  }
}
