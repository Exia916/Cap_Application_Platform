import { NextRequest, NextResponse } from "next/server";
import { listPlaybookCategories } from "@/lib/repositories/playbooksRepo";

export async function GET(req: NextRequest) {
  try {
    const departmentId = req.nextUrl.searchParams.get("departmentId") || undefined;
    const rows = await listPlaybookCategories(departmentId);
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load playbook categories." },
      { status: 500 }
    );
  }
}