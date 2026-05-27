import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listAssignableUsers } from "@/lib/repositories/assignableUsersRepo";

export const runtime = "nodejs";

const BIN_DEPARTMENT = "Overseas Customer Service";

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() || null;

    const rows = await listAssignableUsers({
      q,
      department: BIN_DEPARTMENT,
      limit: 100,
    });

    const qLower = String(q ?? "").trim().toLowerCase();

    const includeUnspecified =
      !qLower || "unspecified".includes(qLower);

    const mappedRows = rows
      .map((row) => {
        const display =
          String(row.displayName ?? "").trim() ||
          String(row.username ?? "").trim();

        if (!display) return null;

        const employeeText =
          row.employeeNumber != null ? `Employee #${row.employeeNumber}` : null;

        return {
          id: row.id,
          code: display,
          description:
            [row.department, employeeText].filter(Boolean).join(" • ") || null,
        };
      })
      .filter(Boolean);

    return NextResponse.json([
      ...(includeUnspecified
        ? [
            {
              id: "__unspecified__",
              code: "Unspecified",
              description: "No Overseas Customer Service bin assigned",
            },
          ]
        : []),
      ...mappedRows,
    ]);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load bins lookup." },
      { status: 500 }
    );
  }
}