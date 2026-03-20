"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MeResponse = {
  username?: string | null;
  role?: string | null;
};

type RecentItem = {
  id: string;
  sourceKey: string;
  title: string;
  href: string;
  createdAt: string;
};

type ApiResponse = {
  items?: RecentItem[];
};

type FallbackItem = {
  href: string;
  title: string;
  subtitle: string;
};

function formatWhen(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";

  const diffMs = Date.now() - dt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return dt.toLocaleDateString();
}

function getFallbackItems(role: string, username: string): FallbackItem[] {
  const isAdmin = role === "ADMIN" || username === "admin";
  const isManager = isAdmin || role === "MANAGER";
  const isSupervisor = isManager || role === "SUPERVISOR";

  if (isAdmin) {
    return [
      {
        href: "/admin",
        title: "Admin Workspace",
        subtitle: "Resume platform administration and shared configuration work.",
      },
      {
        href: "/manager",
        title: "Manager Workspace",
        subtitle: "Open grouped oversight pages and all-view review areas.",
      },
      {
        href: "/admin/master-data",
        title: "Master Data",
        subtitle: "Maintain shared lists and reference values.",
      },
    ];
  }

  if (isManager) {
    return [
      {
        href: "/manager",
        title: "Manager Workspace",
        subtitle: "Resume grouped production oversight and review work.",
      },
      {
        href: "/recuts/supervisor-review",
        title: "Recut Review",
        subtitle: "Continue supervisor or manager recut review tasks.",
      },
      {
        href: "/sales-orders",
        title: "Sales Order Lookup",
        subtitle: "Jump back into order-based lookup and record tracing.",
      },
    ];
  }

  if (isSupervisor) {
    return [
      {
        href: "/recuts/supervisor-review",
        title: "Recut Review",
        subtitle: "Resume supervisor review and follow-up work.",
      },
      {
        href: "/qc-daily-production",
        title: "QC Daily",
        subtitle: "Continue with QC entry or review tasks.",
      },
      {
        href: "/daily-production",
        title: "Daily Production",
        subtitle: "Return to embroidery production records and entry work.",
      },
    ];
  }

  return [
    {
      href: "/daily-production/add",
      title: "New Daily Production Entry",
      subtitle: "Start a new embroidery daily production record.",
    },
    {
      href: "/production/sample-embroidery/add",
      title: "New Sample Embroidery Entry",
      subtitle: "Start a new sample embroidery submission.",
    },
    {
      href: "/recuts",
      title: "Recuts",
      subtitle: "Open recut entry, review, and follow-up records.",
    },
  ];
}

export default function MyWorkCard() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });

        const json = (await res.json().catch(() => ({}))) as MeResponse;

        if (!cancelled) {
          setMe(json);
          setLoadingMe(false);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setLoadingMe(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingMe) return;

    const username = me?.username?.trim();
    if (!username) {
      setItems([]);
      setLoadingItems(false);
      return;
    }

    let cancelled = false;
    setLoadingItems(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/my-work?username=${encodeURIComponent(username)}&limit=6`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const json = (await res.json().catch(() => ({}))) as ApiResponse;

        if (!cancelled) {
          setItems(Array.isArray(json.items) ? json.items : []);
          setLoadingItems(false);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setLoadingItems(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadingMe, me?.username]);

  const role = useMemo(() => (me?.role ?? "").trim().toUpperCase(), [me?.role]);
  const username = useMemo(
    () => (me?.username ?? "").trim().toLowerCase(),
    [me?.username]
  );

  const fallbackItems = useMemo(
    () => getFallbackItems(role, username),
    [role, username]
  );

  const showFallback = !loadingItems && items.length === 0;

  return (
    <section className="card">
      <div className="section-card-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>My Work / Recent Activity</h2>
          <div className="text-soft">
            Recent records you created, with fallback shortcuts when no activity is available.
          </div>
        </div>
      </div>

      {loadingItems ? (
        <div className="dashboard-mywork-loading">
          <div className="text-soft">Loading recent activity…</div>
        </div>
      ) : null}

      {!loadingItems && items.length > 0 ? (
        <div className="dashboard-mywork-list">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="dashboard-mywork-item">
              <div className="dashboard-mywork-copy">
                <div className="dashboard-mywork-title">{item.title}</div>
                <div className="dashboard-mywork-subtitle">
                  Created by you • {formatWhen(item.createdAt)}
                </div>
              </div>

              <div className="dashboard-mywork-arrow" aria-hidden="true">
                →
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {showFallback ? (
        <>
          <div className="dashboard-mywork-list">
            {fallbackItems.map((item) => (
              <Link key={item.href} href={item.href} className="dashboard-mywork-item">
                <div className="dashboard-mywork-copy">
                  <div className="dashboard-mywork-title">{item.title}</div>
                  <div className="dashboard-mywork-subtitle">{item.subtitle}</div>
                </div>

                <div className="dashboard-mywork-arrow" aria-hidden="true">
                  →
                </div>
              </Link>
            ))}
          </div>

          <div className="dashboard-mywork-note">
            No recent DB activity was found for your user yet, so showing suggested starting points instead.
          </div>
        </>
      ) : null}

      <style jsx global>{`
        .dashboard-mywork-loading {
          margin-top: 14px;
          padding: 8px 2px;
        }

        .dashboard-mywork-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .dashboard-mywork-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          text-decoration: none;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          box-shadow: var(--shadow-sm);
          transition:
            background 120ms ease,
            border-color 120ms ease,
            box-shadow 120ms ease,
            transform 120ms ease;
        }

        .dashboard-mywork-item:hover {
          background: var(--surface-subtle);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .dashboard-mywork-copy {
          display: grid;
          gap: 4px;
        }

        .dashboard-mywork-title {
          color: var(--text);
          font-size: 15px;
          font-weight: 800;
          line-height: 1.2;
        }

        .dashboard-mywork-subtitle {
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.4;
        }

        .dashboard-mywork-arrow {
          color: var(--brand-blue);
          font-size: 18px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .dashboard-mywork-note {
          margin-top: 12px;
          color: var(--text-soft);
          font-size: 12px;
          line-height: 1.45;
        }
      `}</style>
    </section>
  );
}