import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listKnitProductionSubmissionsBySalesOrder } from "@/lib/repositories/knitProductionRepo";

type Resp =
  | { submissions: any[] }
  | { error: string };

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
    const submissions = await listKnitProductionSubmissionsBySalesOrder(
      salesOrder,
      canViewAll(auth.role) ? undefined : Number(auth.employeeNumber)
    );

    return NextResponse.json<Resp>({ submissions }, { status: 200 });
  } catch (err) {
    console.error("knit-production-submissions GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}