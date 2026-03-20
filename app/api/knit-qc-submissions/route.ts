import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listKnitQcSubmissionsBySalesOrder } from "@/lib/repositories/knitQcRepo";

/**
 * Lists Knit QC submissions matching a given sales order prefix. Power
 * users (ADMIN/MANAGER/SUPERVISOR) can view all submissions; regular
 * users will only see submissions they created (based on employeeNumber).
 * This endpoint returns minimal submission rows for lookup purposes.
 */

type Resp = { submissions: any[] } | { error: string };

const VIEW_ALL_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function canViewAll(role: unknown) {
  return VIEW_ALL_ROLES.has(String(role ?? "").trim().toUpperCase());
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
  }

  const salesOrder = req.nextUrl.searchParams.get("salesOrder")?.trim() ?? "";
  if (!salesOrder) {
    return NextResponse.json<Resp>({ submissions: [] }, { status: 200 });
  }

  try {
    const submissions = await listKnitQcSubmissionsBySalesOrder(
      salesOrder,
      canViewAll(auth.role) ? undefined : Number(auth.employeeNumber)
    );

    return NextResponse.json<Resp>({ submissions }, { status: 200 });
  } catch (err) {
    console.error("knit-qc-submissions GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}