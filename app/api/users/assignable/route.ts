import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listAssignableUsers } from "@/lib/repositories/assignableUsersRepo";

export const runtime = "nodejs";

type Resp =
  | {
      users: Awaited<ReturnType<typeof listAssignableUsers>>;
    }
  | {
      error: string;
    };

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const q = req.nextUrl.searchParams.get("q");
    const department = req.nextUrl.searchParams.get("department");
    const role = req.nextUrl.searchParams.get("role");
    const limitRaw = req.nextUrl.searchParams.get("limit");

    const users = await listAssignableUsers({
      q,
      department,
      role,
      limit: limitRaw ? Number(limitRaw) : null,
    });

    return NextResponse.json<Resp>({ users }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/users/assignable failed:", err);

    return NextResponse.json<Resp>(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to load assignable users."
            : err?.message || "Failed to load assignable users.",
      },
      { status: 500 }
    );
  }
}