import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listUsersByDepartment } from "@/lib/repositories/userRepo";

/**
 * API endpoint to fetch active users belonging to the Knit department.
 * The query parameter `q` can override the department string but is
 * optional; by default the endpoint returns users whose department
 * starts with "Knit". Only authenticated users with standard roles
 * may access this list.
 */

export const runtime = "nodejs";

type Resp = { users: { id: string; displayName: string | null; employeeNumber: number | null; }[] } | { error: string };

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roleOk(auth.role, VIEW_ROLES)) {
    return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
  }
  try {
    // Optional query parameter allows specifying a department prefix.
    const sp = req.nextUrl.searchParams;
    const dept = sp.get("department")?.trim() || "Knit";
    const users = await listUsersByDepartment(dept);
    return NextResponse.json<Resp>({ users }, { status: 200 });
  } catch (err: any) {
    console.error("knit-qc-users GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}