import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedPlaybookArticleBySlug,
  listRelatedPlaybookArticles,
} from "@/lib/repositories/playbooksRepo";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const row = await getPublishedPlaybookArticleBySlug(slug);

    if (!row) {
      return NextResponse.json({ error: "Playbook article not found." }, { status: 404 });
    }

    const relatedRows = await listRelatedPlaybookArticles(row.id);

    return NextResponse.json({
      row,
      relatedRows: relatedRows.filter((x) => x.status === "published" && !x.isDeleted),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load playbook article." },
      { status: 500 }
    );
  }
}