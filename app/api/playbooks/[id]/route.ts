import { NextRequest, NextResponse } from "next/server";
import {
  getPlaybookArticleById,
  updatePlaybookArticle,
} from "@/lib/repositories/playbooksRepo";

async function requireAdmin(req: NextRequest) {
  const res = await fetch(new URL("/api/me", req.url), {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false as const, status: 401, error: "Unauthorized." };
  }

  const me = await res.json().catch(() => ({} as any));
  const role = String(me?.role ?? "").trim().toUpperCase();
  const username = String(me?.username ?? "").trim().toLowerCase();

  if (role !== "ADMIN" && username !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  return {
    ok: true as const,
    me,
  };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const row = await getPlaybookArticleById(id, { includeDeleted: true });

    if (!row) {
      return NextResponse.json({ error: "Playbook article not found." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load playbook article." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await ctx.params;
    const body = await req.json();

    await updatePlaybookArticle({
      id,
      departmentId: body.departmentId,
      categoryId: body.categoryId,
      title: body.title,
      slug: body.slug,
      summary: body.summary,
      articleType: body.articleType,
      status: body.status,
      contentMarkdown: body.contentMarkdown,
      moduleKey: body.moduleKey,
      audienceRole: body.audienceRole,
      isFeatured: !!body.isFeatured,
      publishedAt: body.publishedAt ?? null,
      updatedBy: auth.me?.displayName || auth.me?.username || null,
      relatedArticleIds: Array.isArray(body.relatedArticleIds) ? body.relatedArticleIds : [],
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update playbook article." },
      { status: 400 }
    );
  }
}