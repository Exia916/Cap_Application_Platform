import { db } from "@/lib/db";

export type PlaybookArticleType =
  | "application_guide"
  | "job_function"
  | "troubleshooting"
  | "reference";

export type PlaybookArticleStatus =
  | "draft"
  | "published"
  | "archived";

export type SortDir = "asc" | "desc";

export type PlaybookDepartmentRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type PlaybookCategoryRow = {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type PlaybookArticleRow = {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  title: string;
  slug: string;
  summary: string | null;
  articleType: PlaybookArticleType;
  status: PlaybookArticleStatus;
  moduleKey: string | null;
  audienceRole: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
};

export type PlaybookArticleDetail = PlaybookArticleRow & {
  contentMarkdown: string;
};

export type ListPlaybookArticlesArgs = {
  q?: string;
  departmentId?: string;
  categoryId?: string;
  articleType?: PlaybookArticleType | "";
  status?: PlaybookArticleStatus | "";
  page?: number;
  pageSize?: number;
  sortBy?:
    | "title"
    | "departmentName"
    | "categoryName"
    | "articleType"
    | "status"
    | "publishedAt"
    | "updatedAt"
    | "createdAt"
    | "isFeatured";
  sortDir?: SortDir;
  includeDeleted?: boolean;
  publicOnly?: boolean;
  featuredOnly?: boolean;
};

export type PagedPlaybookArticlesResult = {
  rows: PlaybookArticleRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreatePlaybookArticleInput = {
  departmentId: string;
  categoryId: string;
  title: string;
  slug?: string | null;
  summary?: string | null;
  articleType: PlaybookArticleType;
  status?: PlaybookArticleStatus;
  contentMarkdown: string;
  moduleKey?: string | null;
  audienceRole?: string | null;
  isFeatured?: boolean;
  publishedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  relatedArticleIds?: string[];
};

export type UpdatePlaybookArticleInput = {
  id: string;
  departmentId: string;
  categoryId: string;
  title: string;
  slug?: string | null;
  summary?: string | null;
  articleType: PlaybookArticleType;
  status: PlaybookArticleStatus;
  contentMarkdown: string;
  moduleKey?: string | null;
  audienceRole?: string | null;
  isFeatured?: boolean;
  publishedAt?: string | null;
  updatedBy?: string | null;
  relatedArticleIds?: string[];
};

const ALLOWED_ARTICLE_TYPES: PlaybookArticleType[] = [
  "application_guide",
  "job_function",
  "troubleshooting",
  "reference",
];

const ALLOWED_STATUSES: PlaybookArticleStatus[] = [
  "draft",
  "published",
  "archived",
];

function toPositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function normalizeNullableText(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function ensureArticleType(value: unknown): PlaybookArticleType {
  const v = String(value ?? "").trim() as PlaybookArticleType;
  if (!ALLOWED_ARTICLE_TYPES.includes(v)) {
    throw new Error("Invalid article type.");
  }
  return v;
}

function ensureStatus(value: unknown, fallback: PlaybookArticleStatus = "draft"): PlaybookArticleStatus {
  const v = String(value ?? fallback).trim() as PlaybookArticleStatus;
  if (!ALLOWED_STATUSES.includes(v)) {
    throw new Error("Invalid article status.");
  }
  return v;
}

function slugify(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function resolvePublishedAt(status: PlaybookArticleStatus, explicitPublishedAt?: string | null): string | null {
  if (status !== "published") return null;
  const clean = normalizeNullableText(explicitPublishedAt);
  return clean ?? new Date().toISOString();
}

function articleSelectSql() {
  return `
    SELECT
      a.id,
      a.department_id AS "departmentId",
      d.name AS "departmentName",
      d.slug AS "departmentSlug",
      a.category_id AS "categoryId",
      c.name AS "categoryName",
      c.slug AS "categorySlug",
      a.title,
      a.slug,
      a.summary,
      a.article_type AS "articleType",
      a.status,
      a.module_key AS "moduleKey",
      a.audience_role AS "audienceRole",
      a.is_featured AS "isFeatured",
      a.published_at AS "publishedAt",
      a.created_at AS "createdAt",
      a.created_by AS "createdBy",
      a.updated_at AS "updatedAt",
      a.updated_by AS "updatedBy",
      a.is_deleted AS "isDeleted",
      a.deleted_at AS "deletedAt",
      a.deleted_by AS "deletedBy"
    FROM public.playbook_articles a
    INNER JOIN public.playbook_departments d
      ON d.id = a.department_id
    INNER JOIN public.playbook_categories c
      ON c.id = a.category_id
  `;
}

function articleDetailSelectSql() {
  return `
    SELECT
      a.id,
      a.department_id AS "departmentId",
      d.name AS "departmentName",
      d.slug AS "departmentSlug",
      a.category_id AS "categoryId",
      c.name AS "categoryName",
      c.slug AS "categorySlug",
      a.title,
      a.slug,
      a.summary,
      a.article_type AS "articleType",
      a.status,
      a.content_markdown AS "contentMarkdown",
      a.module_key AS "moduleKey",
      a.audience_role AS "audienceRole",
      a.is_featured AS "isFeatured",
      a.published_at AS "publishedAt",
      a.created_at AS "createdAt",
      a.created_by AS "createdBy",
      a.updated_at AS "updatedAt",
      a.updated_by AS "updatedBy",
      a.is_deleted AS "isDeleted",
      a.deleted_at AS "deletedAt",
      a.deleted_by AS "deletedBy"
    FROM public.playbook_articles a
    INNER JOIN public.playbook_departments d
      ON d.id = a.department_id
    INNER JOIN public.playbook_categories c
      ON c.id = a.category_id
  `;
}

function buildWhere(args: ListPlaybookArticlesArgs) {
  const where: string[] = [];
  const params: any[] = [];

  if (args.includeDeleted) {
    where.push("1=1");
  } else {
    where.push("COALESCE(a.is_deleted, false) = false");
  }

  if (args.publicOnly) {
    where.push(`a.status = 'published'`);
    where.push(`d.is_active = true`);
    where.push(`c.is_active = true`);
  }

  if (args.featuredOnly) {
    where.push(`a.is_featured = true`);
  }

  if (args.departmentId) {
    params.push(args.departmentId);
    where.push(`a.department_id = $${params.length}::uuid`);
  }

  if (args.categoryId) {
    params.push(args.categoryId);
    where.push(`a.category_id = $${params.length}::uuid`);
  }

  if (args.articleType) {
    params.push(ensureArticleType(args.articleType));
    where.push(`a.article_type = $${params.length}`);
  }

  if (args.status) {
    params.push(ensureStatus(args.status));
    where.push(`a.status = $${params.length}`);
  }

  const q = String(args.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(`
      (
        a.title ILIKE ${p}
        OR COALESCE(a.summary, '') ILIKE ${p}
        OR COALESCE(a.content_markdown, '') ILIKE ${p}
        OR d.name ILIKE ${p}
        OR c.name ILIKE ${p}
        OR COALESCE(a.module_key, '') ILIKE ${p}
        OR COALESCE(a.audience_role, '') ILIKE ${p}
      )
    `);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

function getOrderBy(sortBy?: ListPlaybookArticlesArgs["sortBy"], sortDir?: SortDir, publicOnly?: boolean) {
  const dir = String(sortDir ?? "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  if (publicOnly) {
    return `
      a.is_featured DESC,
      COALESCE(a.published_at, a.updated_at, a.created_at) DESC,
      d.sort_order ASC,
      c.sort_order ASC,
      a.title ASC
    `;
  }

  const map: Record<string, string> = {
    title: `a.title ${dir}`,
    departmentName: `d.name ${dir}`,
    categoryName: `c.name ${dir}`,
    articleType: `a.article_type ${dir}`,
    status: `a.status ${dir}`,
    publishedAt: `a.published_at ${dir} NULLS LAST`,
    updatedAt: `a.updated_at ${dir}`,
    createdAt: `a.created_at ${dir}`,
    isFeatured: `a.is_featured ${dir}`,
  };

  return map[String(sortBy ?? "")] ?? `a.updated_at DESC, a.created_at DESC, a.title ASC`;
}

async function assertDepartmentAndCategoryMatch(departmentId: string, categoryId: string) {
  const { rows } = await db.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.playbook_categories c
      WHERE c.id = $1::uuid
        AND c.department_id = $2::uuid
    ) AS ok
    `,
    [categoryId, departmentId]
  );

  if (!rows[0]?.ok) {
    throw new Error("Selected category does not belong to the selected department.");
  }
}

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

async function replaceRelatedArticleLinks(
  queryable: Queryable,
  articleId: string,
  relatedArticleIds: string[] | undefined,
  changedBy?: string | null
) {
  const nextIds = Array.from(
    new Set((relatedArticleIds ?? []).map((x) => String(x).trim()).filter(Boolean))
  ).filter((x) => x !== articleId);

  await queryable.query(
    `DELETE FROM public.playbook_article_links WHERE article_id = $1::uuid`,
    [articleId]
  );

  for (let i = 0; i < nextIds.length; i += 1) {
    await queryable.query(
      `
      INSERT INTO public.playbook_article_links (
        article_id,
        related_article_id,
        sort_order,
        created_by
      )
      VALUES ($1::uuid, $2::uuid, $3, $4)
      ON CONFLICT (article_id, related_article_id) DO NOTHING
      `,
      [articleId, nextIds[i], (i + 1) * 10, changedBy ?? null]
    );
  }
}

export async function listPlaybookDepartments(): Promise<PlaybookDepartmentRow[]> {
  const { rows } = await db.query<PlaybookDepartmentRow>(
    `
    SELECT
      id,
      name,
      slug,
      description,
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    FROM public.playbook_departments
    WHERE is_active = true
    ORDER BY sort_order ASC, name ASC
    `
  );

  return rows;
}

export async function listPlaybookCategories(departmentId?: string): Promise<PlaybookCategoryRow[]> {
  const params: any[] = [];
  let whereSql = `WHERE c.is_active = true AND d.is_active = true`;

  if (departmentId) {
    params.push(departmentId);
    whereSql += ` AND c.department_id = $${params.length}::uuid`;
  }

  const { rows } = await db.query<PlaybookCategoryRow>(
    `
    SELECT
      c.id,
      c.department_id AS "departmentId",
      d.name AS "departmentName",
      d.slug AS "departmentSlug",
      c.name,
      c.slug,
      c.description,
      c.sort_order AS "sortOrder",
      c.is_active AS "isActive",
      c.created_at AS "createdAt",
      c.created_by AS "createdBy",
      c.updated_at AS "updatedAt",
      c.updated_by AS "updatedBy"
    FROM public.playbook_categories c
    INNER JOIN public.playbook_departments d
      ON d.id = c.department_id
    ${whereSql}
    ORDER BY d.sort_order ASC, d.name ASC, c.sort_order ASC, c.name ASC
    `,
    params
  );

  return rows;
}

export async function listPlaybookArticles(
  args: ListPlaybookArticlesArgs = {}
): Promise<PagedPlaybookArticlesResult> {
  const page = toPositiveInt(args.page, 1);
  const pageSize = Math.min(toPositiveInt(args.pageSize, 25), 200);
  const offset = (page - 1) * pageSize;

  const { whereSql, params } = buildWhere(args);
  const orderBy = getOrderBy(args.sortBy, args.sortDir, args.publicOnly);

  const countRes = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM public.playbook_articles a
    INNER JOIN public.playbook_departments d
      ON d.id = a.department_id
    INNER JOIN public.playbook_categories c
      ON c.id = a.category_id
    ${whereSql}
    `,
    params
  );

  const listParams = [...params, pageSize, offset];

  const { rows } = await db.query<PlaybookArticleRow>(
    `
    ${articleSelectSql()}
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${listParams.length - 1}
    OFFSET $${listParams.length}
    `,
    listParams
  );

  return {
    rows,
    total: Number(countRes.rows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getPlaybookArticleById(
  id: string,
  opts?: { includeDeleted?: boolean }
): Promise<PlaybookArticleDetail | null> {
  const params: any[] = [id];
  const where: string[] = [`a.id = $1::uuid`];

  if (!opts?.includeDeleted) {
    where.push(`COALESCE(a.is_deleted, false) = false`);
  }

  const { rows } = await db.query<PlaybookArticleDetail>(
    `
    ${articleDetailSelectSql()}
    WHERE ${where.join(" AND ")}
    LIMIT 1
    `,
    params
  );

  return rows[0] ?? null;
}

export async function getPublishedPlaybookArticleBySlug(
  slug: string
): Promise<PlaybookArticleDetail | null> {
  const cleanSlug = slugify(slug);
  if (!cleanSlug) return null;

  const { rows } = await db.query<PlaybookArticleDetail>(
    `
    ${articleDetailSelectSql()}
    WHERE a.slug = $1
      AND a.status = 'published'
      AND COALESCE(a.is_deleted, false) = false
      AND d.is_active = true
      AND c.is_active = true
    LIMIT 1
    `,
    [cleanSlug]
  );

  return rows[0] ?? null;
}

export async function createPlaybookArticle(
  input: CreatePlaybookArticleInput
): Promise<{ id: string }> {
  const title = String(input.title ?? "").trim();
  const contentMarkdown = String(input.contentMarkdown ?? "").trim();

  if (!title) throw new Error("Title is required.");
  if (!contentMarkdown) throw new Error("Markdown content is required.");

  const articleType = ensureArticleType(input.articleType);
  const status = ensureStatus(input.status ?? "draft");
  const slug = slugify(String(input.slug ?? "") || title);

  if (!slug) throw new Error("Slug is required.");

  await assertDepartmentAndCategoryMatch(input.departmentId, input.categoryId);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const publishedAt = resolvePublishedAt(status, input.publishedAt);

    const insertRes = await client.query<{ id: string }>(
      `
      INSERT INTO public.playbook_articles (
        department_id,
        category_id,
        title,
        slug,
        summary,
        article_type,
        status,
        content_markdown,
        module_key,
        audience_role,
        is_featured,
        published_at,
        created_by,
        updated_by
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      RETURNING id
      `,
      [
        input.departmentId,
        input.categoryId,
        title,
        slug,
        normalizeNullableText(input.summary),
        articleType,
        status,
        contentMarkdown,
        normalizeNullableText(input.moduleKey),
        normalizeNullableText(input.audienceRole),
        !!input.isFeatured,
        publishedAt,
        normalizeNullableText(input.createdBy),
        normalizeNullableText(input.updatedBy ?? input.createdBy),
      ]
    );

    const id = insertRes.rows[0]?.id;
    if (!id) throw new Error("Failed to create playbook article.");

    await replaceRelatedArticleLinks(
      client,
      id,
      input.relatedArticleIds,
      input.updatedBy ?? input.createdBy ?? null
    );

    await client.query("COMMIT");
    return { id };
  } catch (err: any) {
    await client.query("ROLLBACK");

    if (String(err?.message ?? "").includes("playbook_articles_slug_key")) {
      throw new Error("An article with this slug already exists.");
    }

    throw err;
  } finally {
    client.release();
  }
}

export async function updatePlaybookArticle(
  input: UpdatePlaybookArticleInput
): Promise<void> {
  const title = String(input.title ?? "").trim();
  const contentMarkdown = String(input.contentMarkdown ?? "").trim();

  if (!title) throw new Error("Title is required.");
  if (!contentMarkdown) throw new Error("Markdown content is required.");

  const articleType = ensureArticleType(input.articleType);
  const status = ensureStatus(input.status);
  const slug = slugify(String(input.slug ?? "") || title);

  if (!slug) throw new Error("Slug is required.");

  await assertDepartmentAndCategoryMatch(input.departmentId, input.categoryId);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const publishedAt = resolvePublishedAt(status, input.publishedAt);

    const updateRes = await client.query(
      `
      UPDATE public.playbook_articles
      SET
        department_id = $2::uuid,
        category_id = $3::uuid,
        title = $4,
        slug = $5,
        summary = $6,
        article_type = $7,
        status = $8,
        content_markdown = $9,
        module_key = $10,
        audience_role = $11,
        is_featured = $12,
        published_at = $13,
        updated_at = NOW(),
        updated_by = $14
      WHERE id = $1::uuid
      RETURNING id
      `,
      [
        input.id,
        input.departmentId,
        input.categoryId,
        title,
        slug,
        normalizeNullableText(input.summary),
        articleType,
        status,
        contentMarkdown,
        normalizeNullableText(input.moduleKey),
        normalizeNullableText(input.audienceRole),
        !!input.isFeatured,
        publishedAt,
        normalizeNullableText(input.updatedBy),
      ]
    );

    if ((updateRes.rowCount ?? 0) <= 0) {
      throw new Error("Playbook article not found.");
    }

    await replaceRelatedArticleLinks(
      client,
      input.id,
      input.relatedArticleIds,
      input.updatedBy ?? null
    );

    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK");

    if (String(err?.message ?? "").includes("playbook_articles_slug_key")) {
      throw new Error("An article with this slug already exists.");
    }

    throw err;
  } finally {
    client.release();
  }
}

export async function listRelatedPlaybookArticles(articleId: string): Promise<PlaybookArticleRow[]> {
  const { rows } = await db.query<PlaybookArticleRow>(
    `
    SELECT
      ra.id,
      ra.department_id AS "departmentId",
      d.name AS "departmentName",
      d.slug AS "departmentSlug",
      ra.category_id AS "categoryId",
      c.name AS "categoryName",
      c.slug AS "categorySlug",
      ra.title,
      ra.slug,
      ra.summary,
      ra.article_type AS "articleType",
      ra.status,
      ra.module_key AS "moduleKey",
      ra.audience_role AS "audienceRole",
      ra.is_featured AS "isFeatured",
      ra.published_at AS "publishedAt",
      ra.created_at AS "createdAt",
      ra.created_by AS "createdBy",
      ra.updated_at AS "updatedAt",
      ra.updated_by AS "updatedBy",
      ra.is_deleted AS "isDeleted",
      ra.deleted_at AS "deletedAt",
      ra.deleted_by AS "deletedBy"
    FROM public.playbook_article_links l
    INNER JOIN public.playbook_articles ra
      ON ra.id = l.related_article_id
    INNER JOIN public.playbook_departments d
      ON d.id = ra.department_id
    INNER JOIN public.playbook_categories c
      ON c.id = ra.category_id
    WHERE l.article_id = $1::uuid
      AND COALESCE(ra.is_deleted, false) = false
    ORDER BY l.sort_order ASC, ra.title ASC
    `,
    [articleId]
  );

  return rows;
}