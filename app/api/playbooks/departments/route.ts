import { NextResponse } from "next/server";
import { listPlaybookDepartments } from "@/lib/repositories/playbooksRepo";

export async function GET() {
  try {
    const rows = await listPlaybookDepartments();
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load playbook departments." },
      { status: 500 }
    );
  }
}