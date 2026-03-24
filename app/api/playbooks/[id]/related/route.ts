import { NextRequest, NextResponse } from "next/server";
import { listRelatedPlaybookArticles } from "@/lib/repositories/playbooksRepo";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const rows = await listRelatedPlaybookArticles(id);
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load related playbook articles." },
      { status: 500 }
    );
  }
}