"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";

type DepartmentRow = {
  id: string;
  name: string;
};

type CategoryRow = {
  id: string;
  departmentId: string;
  departmentName: string;
  name: string;
};

type ArticleOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
  isDeleted: boolean;
};

type LoadedArticle = {
  id: string;
  departmentId: string;
  categoryId: string;
  title: string;
  slug: string;
  summary: string | null;
  articleType: string;
  status: string;
  contentMarkdown: string;
  moduleKey: string | null;
  audienceRole: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
};

type Props = {
  articleId?: string;
};

function buildLocalSlug(title: string) {
  return String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

export default function PlaybookEditorForm({ articleId }: Props) {
  const router = useRouter();
  const isEditMode = !!articleId;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([]);
  const [relatedRows, setRelatedRows] = useState<{ id: string }[]>([]);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [articleType, setArticleType] = useState("application_guide");
  const [status, setStatus] = useState("draft");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [moduleKey, setModuleKey] = useState("");
  const [audienceRole, setAudienceRole] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");

  const [touchedSlug, setTouchedSlug] = useState(false);
  const [selectedRelatedIds, setSelectedRelatedIds] = useState<string[]>([]);

  const visibleCategories = useMemo(
    () => categories.filter((x) => !departmentId || x.departmentId === departmentId),
    [categories, departmentId]
  );

  useEffect(() => {
    (async () => {
      try {
        const [deptRes, catRes, articleListRes] = await Promise.all([
          fetch("/api/playbooks/departments", { cache: "no-store" }),
          fetch("/api/playbooks/categories", { cache: "no-store" }),
          fetch("/api/playbooks?publicOnly=false&page=1&pageSize=250&sortBy=title&sortDir=asc", {
            cache: "no-store",
          }),
        ]);

        const deptData = await deptRes.json().catch(() => ({}));
        const catData = await catRes.json().catch(() => ({}));
        const articleData = await articleListRes.json().catch(() => ({}));

        if (deptRes.ok) setDepartments(Array.isArray(deptData?.rows) ? deptData.rows : []);
        if (catRes.ok) setCategories(Array.isArray(catData?.rows) ? catData.rows : []);
        if (articleListRes.ok) {
          setArticleOptions(Array.isArray(articleData?.rows) ? articleData.rows : []);
        }
      } catch {
        // form can still open
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEditMode || !articleId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [articleRes, relatedRes] = await Promise.all([
          fetch(`/api/playbooks/${encodeURIComponent(articleId)}`, { cache: "no-store" }),
          fetch(`/api/playbooks/${encodeURIComponent(articleId)}/related`, { cache: "no-store" }),
        ]);

        const articleData = await articleRes.json().catch(() => ({}));
        const relatedData = await relatedRes.json().catch(() => ({}));

        if (!articleRes.ok) {
          throw new Error(articleData?.error || "Failed to load playbook article.");
        }

        const row = articleData?.row as LoadedArticle;
        setTitle(row.title || "");
        setSlug(row.slug || "");
        setSummary(row.summary || "");
        setDepartmentId(row.departmentId || "");
        setCategoryId(row.categoryId || "");
        setArticleType(row.articleType || "application_guide");
        setStatus(row.status || "draft");
        setContentMarkdown(row.contentMarkdown || "");
        setModuleKey(row.moduleKey || "");
        setAudienceRole(row.audienceRole || "");
        setIsFeatured(!!row.isFeatured);
        setPublishedAt(row.publishedAt ? String(row.publishedAt).slice(0, 16) : "");

        const related = Array.isArray(relatedData?.rows) ? relatedData.rows : [];
        setRelatedRows(related);
        setSelectedRelatedIds(related.map((x: any) => x.id));
      } catch (err: any) {
        setError(err?.message || "Failed to load playbook article.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditMode, articleId]);

  useEffect(() => {
    if (!touchedSlug) {
      setSlug(buildLocalSlug(title));
    }
  }, [title, touchedSlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        departmentId,
        categoryId,
        title,
        slug,
        summary: summary || null,
        articleType,
        status,
        contentMarkdown,
        moduleKey: moduleKey || null,
        audienceRole: audienceRole || null,
        isFeatured,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
        relatedArticleIds: selectedRelatedIds,
      };

      const res = await fetch(
        isEditMode
          ? `/api/playbooks/${encodeURIComponent(articleId || "")}`
          : "/api/playbooks",
        {
          method: isEditMode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Save failed.");
      }

      const targetId = isEditMode ? articleId! : data?.id;
      router.push(
        targetId
          ? `/admin/playbooks/${encodeURIComponent(targetId)}/edit`
          : "/admin/playbooks"
      );
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="card text-muted">Loading playbook editor…</div>;
  }

  return (
    <form onSubmit={onSubmit} className="section-stack">
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="section-card card">
        <div className="section-card-header">
          <h2 style={{ margin: 0 }}>Article Info</h2>
        </div>

        <div className="form-grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Embroidery Daily Production - Creating an Entry"
              required
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Slug</label>
            <input
              className="input"
              value={slug}
              onChange={(e) => {
                setTouchedSlug(true);
                setSlug(e.target.value);
              }}
              placeholder="production-embroidery-create-entry"
              required
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Summary</label>
            <textarea
              className="textarea"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short summary shown on cards and article landing views."
            />
          </div>
        </div>
      </div>

      <div className="section-card card">
        <div className="section-card-header">
          <h2 style={{ margin: 0 }}>Organization</h2>
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">Department</label>
            <select
              className="select"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setCategoryId("");
              }}
              required
            >
              <option value="">Select department</option>
              {departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Category</label>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select category</option>
              {visibleCategories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.departmentName} · {row.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Article Type</label>
            <select
              className="select"
              value={articleType}
              onChange={(e) => setArticleType(e.target.value)}
            >
              <option value="application_guide">application_guide</option>
              <option value="job_function">job_function</option>
              <option value="troubleshooting">troubleshooting</option>
              <option value="reference">reference</option>
            </select>
          </div>

          <div>
            <label className="field-label">Module Key</label>
            <input
              className="input"
              value={moduleKey}
              onChange={(e) => setModuleKey(e.target.value)}
              placeholder="daily-production / recuts / cmms"
            />
          </div>

          <div>
            <label className="field-label">Audience Role</label>
            <input
              className="input"
              value={audienceRole}
              onChange={(e) => setAudienceRole(e.target.value)}
              placeholder="ADMIN / MANAGER / USER / SUPERVISOR"
            />
          </div>
        </div>
      </div>

      <div className="section-card card">
        <div className="section-card-header">
          <h2 style={{ margin: 0 }}>Publishing</h2>
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">Status</label>
            <select
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </div>

          <div>
            <label className="field-label">Published At</label>
            <input
              className="input"
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Featured</label>
            <label className="muted-box" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              <span>{isFeatured ? "Yes" : "No"}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="section-card card">
        <div className="section-card-header">
          <h2 style={{ margin: 0 }}>Markdown Content</h2>
        </div>

        <label className="field-label">Content</label>
        <textarea
          className="textarea"
          rows={20}
          value={contentMarkdown}
          onChange={(e) => setContentMarkdown(e.target.value)}
          placeholder="# Title

Step-by-step instructions go here..."
          required
          style={{ resize: "vertical" }}
        />
      </div>

      <div className="section-card card">
        <div className="section-card-header">
          <h2 style={{ margin: 0 }}>Related Articles</h2>
        </div>

        <select
          className="select"
          multiple
          value={selectedRelatedIds}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
            setSelectedRelatedIds(values);
          }}
          style={{ minHeight: 220 }}
        >
          {articleOptions
            .filter((row) => row.id !== articleId && !row.isDeleted)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.title} ({row.status})
              </option>
            ))}
        </select>

        <div className="field-help">
          Hold Ctrl or Command to select multiple related articles.
        </div>
      </div>

      {articleId ? (
        <>
          <div className="section-card card">
            <div className="section-card-header">
              <h2 style={{ margin: 0 }}>Supporting Files</h2>
            </div>

            <AttachmentsPanel
              entityType="playbook_article"
              entityId={articleId}
            />
          </div>

          <div className="section-card card">
            <div className="section-card-header">
              <h2 style={{ margin: 0 }}>Activity History</h2>
            </div>

            <ActivityHistoryPanel
              entityType="playbook_article"
              entityId={articleId}
              defaultExpanded={false}
            />
          </div>
        </>
      ) : null}

      <div className="sticky-actions">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEditMode ? "Save Changes" : "Create Playbook"}
          </button>

          <Link href="/admin/playbooks" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}