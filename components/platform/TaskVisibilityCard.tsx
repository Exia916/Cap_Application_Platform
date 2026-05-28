"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TaskScope = "mine" | "oversight";

type TaskSummary = {
  active: number;
  overdue: number;
  dueToday: number;
  blocked: number;
  highPriority: number;
  completed: number;
  canceled: number;
};

type Props = {
  scope: TaskScope;
  title?: string;
  subtitle?: string;
  href?: string;
  compact?: boolean;
};

const EMPTY_SUMMARY: TaskSummary = {
  active: 0,
  overdue: 0,
  dueToday: 0,
  blocked: 0,
  highPriority: 0,
  completed: 0,
  canceled: 0,
};

function queueHref(scope: TaskScope, filter?: "active" | "overdue" | "dueToday" | "blocked" | "high") {
  const base = scope === "oversight" ? "/manager/tasks" : "/my-work";

  // The current queue reads filters internally, not URL params.
  // These links still route users to the correct queue page.
  // URL filter support can be added later without changing this component.
  return base;
}

function SummaryTile({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone: "primary" | "danger" | "warning" | "neutral";
  href: string;
}) {
  const badgeClass =
    tone === "danger"
      ? "badge badge-danger"
      : tone === "warning"
        ? "badge badge-warning"
        : tone === "primary"
          ? "badge badge-brand-blue"
          : "badge badge-neutral";

  return (
    <Link
      href={href}
      style={{
        display: "grid",
        gap: 8,
        textDecoration: "none",
        border: "1px solid var(--border)",
        background: "var(--surface-subtle)",
        borderRadius: 14,
        padding: 14,
        minHeight: 92,
        color: "inherit",
      }}
    >
      <span className={badgeClass} style={{ width: "fit-content" }}>
        {label}
      </span>

      <span
        style={{
          color: "var(--text)",
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </Link>
  );
}

export default function TaskVisibilityCard({
  scope,
  title,
  subtitle,
  href,
  compact = false,
}: Props) {
  const [summary, setSummary] = useState<TaskSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queueLink = href || (scope === "oversight" ? "/manager/tasks" : "/my-work");

  const effectiveTitle = useMemo(() => {
    if (title) return title;
    return scope === "oversight" ? "Task Oversight" : "My Work";
  }, [scope, title]);

  const effectiveSubtitle = useMemo(() => {
    if (subtitle) return subtitle;

    return scope === "oversight"
      ? "Open task load across the platform."
      : "Your active assignments and upcoming work.";
  }, [scope, subtitle]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/platform/tasks/summary?scope=${scope}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load task summary.");
      }

      setSummary({
        active: Number(data?.active ?? 0),
        overdue: Number(data?.overdue ?? 0),
        dueToday: Number(data?.dueToday ?? 0),
        blocked: Number(data?.blocked ?? 0),
        highPriority: Number(data?.highPriority ?? 0),
        completed: Number(data?.completed ?? 0),
        canceled: Number(data?.canceled ?? 0),
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load task summary.");
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    function onFocus() {
      load();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        load();
      }
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [scope]);

  return (
    <section className="card">
      <div className="section-card-header">
        <div>
          <h2 style={{ margin: 0 }}>{effectiveTitle}</h2>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            {effectiveSubtitle}
          </p>
        </div>

        <Link href={queueLink} className="btn btn-secondary">
          Open Queue
        </Link>
      </div>

      {error ? (
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact
            ? "repeat(auto-fit, minmax(130px, 1fr))"
            : "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        <SummaryTile
          label={loading ? "Loading" : "Active"}
          value={loading ? 0 : summary.active}
          tone="primary"
          href={queueHref(scope, "active")}
        />

        <SummaryTile
          label="Overdue"
          value={loading ? 0 : summary.overdue}
          tone={summary.overdue > 0 ? "danger" : "neutral"}
          href={queueHref(scope, "overdue")}
        />

        <SummaryTile
          label="Due Today"
          value={loading ? 0 : summary.dueToday}
          tone={summary.dueToday > 0 ? "warning" : "neutral"}
          href={queueHref(scope, "dueToday")}
        />

        <SummaryTile
          label="Blocked"
          value={loading ? 0 : summary.blocked}
          tone={summary.blocked > 0 ? "warning" : "neutral"}
          href={queueHref(scope, "blocked")}
        />

        <SummaryTile
          label="High Priority"
          value={loading ? 0 : summary.highPriority}
          tone={summary.highPriority > 0 ? "danger" : "neutral"}
          href={queueHref(scope, "high")}
        />
      </div>

      <div className="field-help" style={{ marginTop: 10 }}>
        Counts refresh when the page loads, when the tab regains focus, and after returning to the page.
      </div>
    </section>
  );
}