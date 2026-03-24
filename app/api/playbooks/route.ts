import { NextRequest, NextResponse } from "next/server";
import {
  createPlaybookArticle,
  listPlaybookArticles,
  type PlaybookArticleStatus,
  type PlaybookArticleType,
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

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const page = Number(sp.get("page") ?? 1);
    const pageSize = Number(sp.get("pageSize") ?? 25);

    const status = (sp.get("status") ?? "") as PlaybookArticleStatus | "";
    const articleType = (sp.get("articleType") ?? "") as PlaybookArticleType | "";
    const includeDeleted = sp.get("includeDeleted") === "true";
    const publicOnly = sp.get("publicOnly") !== "false";
    const featuredOnly = sp.get("featuredOnly") === "true";

    const result = await listPlaybookArticles({
      q: sp.get("q") ?? "",
      departmentId: sp.get("departmentId") ?? "",
      categoryId: sp.get("categoryId") ?? "",
      articleType,
      status,
      page,
      pageSize,
      sortBy: (sp.get("sortBy") as any) ?? "updatedAt",
      sortDir: (sp.get("sortDir") as any) ?? (publicOnly ? "desc" : "asc"),
      includeDeleted,
      publicOnly,
      featuredOnly,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load playbook articles." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();

    const created = await createPlaybookArticle({
      departmentId: body.departmentId,
      categoryId: body.categoryId,
      title: body.title,
      slug: body.slug,
      summary: body.summary,
      articleType: body.articleType,
      status: body.status ?? "draft",
      contentMarkdown: body.contentMarkdown,
      moduleKey: body.moduleKey,
      audienceRole: body.audienceRole,
      isFeatured: !!body.isFeatured,
      publishedAt: body.publishedAt ?? null,
      createdBy: auth.me?.displayName || auth.me?.username || null,
      updatedBy: auth.me?.displayName || auth.me?.username || null,
      relatedArticleIds: Array.isArray(body.relatedArticleIds) ? body.relatedArticleIds : [],
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create playbook article." },
      { status: 400 }
    );
  }
}