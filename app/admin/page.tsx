"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  role?: string | null;
};

type AdminLinkItem = {
  href: string;
  title: string;
  description: string;
};

type AdminGroup = {
  title: string;
  subtitle: string;
  items: AdminLinkItem[];
};

export default function AdminHomePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

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
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const role = useMemo(() => (me?.role ?? "").trim().toUpperCase(), [me?.role]);
  const username = useMemo(() => (me?.username ?? "").trim().toLowerCase(), [me?.username]);
  const displayName = useMemo(
    () => me?.displayName?.trim() || me?.username?.trim() || "Administrator",
    [me?.displayName, me?.username]
  );

  const isAdmin = role === "ADMIN" || username === "admin";

  useEffect(() => {
    if (!loaded) return;
    if (!isAdmin) router.replace("/dashboard");
  }, [loaded, isAdmin, router]);

  const groups: AdminGroup[] = [
    {
      title: "Administration",
      subtitle: "Core administrative areas for user and application management.",
      items: [
        {
          href: "/admin/users",
          title: "Admin Users",
          description: "Manage platform users, roles, and account access.",
        },
        {
          href: "/admin/logs",
          title: "Application Logs",
          description: "Review application activity, events, and operational troubleshooting details.",
        },
      ],
    },
    {
      title: "Configuration",
      subtitle: "Shared list and lookup maintenance for platform-controlled values.",
      items: [
        {
          href: "/admin/master-data",
          title: "Master Data (Lists)",
          description: "Manage shared list values, lookup sources, and configurable reference data.",
        },
      ],
    },
    {
      title: "Platform",
      subtitle: "Administrative entry points into broader platform areas.",
      items: [
        {
          href: "/dashboard",
          title: "Home Dashboard",
          description: "Return to the main dashboard and shared operational landing area.",
        },
        {
          href: "/manager",
          title: "Manager Workspace",
          description: "Open the manager oversight landing page and grouped all-view areas.",
        },
      ],
    },
  ];

  const totalShortcuts = groups.reduce((sum, group) => sum + group.items.length, 0);

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card">
          <div className="text-muted">Loading admin workspace…</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="page-shell-wide">
      <div className="admin-page">
        <header className="admin-hero card card-lg">
          <div className="admin-hero-main">
            <div className="admin-kicker">Admin Workspace</div>
            <h1 className="admin-title">Admin Landing Page</h1>
            <p className="admin-subtitle">
              Welcome, <strong>{displayName}</strong>. Use this workspace to manage
              users, shared lists, and platform administration pages.
            </p>
          </div>

          <div className="admin-hero-side">
            <div className="admin-summary-card">
              <div className="admin-summary-label">Role</div>
              <div className="admin-summary-value">{role || "ADMIN"}</div>
            </div>

            <div className="admin-summary-card">
              <div className="admin-summary-label">Groups</div>
              <div className="admin-summary-value">{groups.length}</div>
            </div>

            <div className="admin-summary-card">
              <div className="admin-summary-label">Shortcuts</div>
              <div className="admin-summary-value">{totalShortcuts}</div>
            </div>
          </div>
        </header>

        <section className="admin-toolbar card">
          <div className="section-card-header" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>Quick Tools</h2>
              <div className="text-soft">
                Common administrative destinations across the platform.
              </div>
            </div>
          </div>

          <div className="admin-toolbar-actions">
            <Link href="/dashboard" className="btn btn-secondary">
              Home
            </Link>
            <Link href="/admin/users" className="btn btn-secondary">
              Admin Users
            </Link>
            <Link href="/admin/master-data" className="btn btn-secondary">
              Master Data
            </Link>
            <Link href="/admin/logs" className="btn btn-secondary">
              Application Logs
            </Link>
            <Link href="/manager" className="btn btn-secondary">
              Manager Workspace
            </Link>
          </div>
        </section>

        <section className="admin-groups">
          {groups.map((group) => (
            <div key={group.title} className="admin-group card">
              <div className="admin-group-head">
                <div>
                  <h2 className="admin-group-title">{group.title}</h2>
                  <p className="admin-group-subtitle">{group.subtitle}</p>
                </div>

                <div className="admin-group-count">
                  {group.items.length} {group.items.length === 1 ? "Page" : "Pages"}
                </div>
              </div>

              <div className="admin-link-grid">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="admin-link-card">
                    <div className="admin-link-top">
                      <div className="admin-link-title">{item.title}</div>
                      <div className="admin-link-arrow" aria-hidden="true">
                        →
                      </div>
                    </div>

                    <div className="admin-link-description">{item.description}</div>

                    <div className="admin-link-footer">Open page</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      <style jsx global>{`
        .admin-page {
          display: grid;
          gap: 16px;
        }

        .admin-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr);
          gap: 20px;
          align-items: stretch;
        }

        .admin-hero-main {
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .admin-kicker {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-soft);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .admin-title {
          margin: 0;
          color: var(--text);
        }

        .admin-subtitle {
          margin: 0;
          color: var(--text-muted);
          max-width: 900px;
          font-size: 14px;
        }

        .admin-hero-side {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .admin-summary-card {
          border: 1px solid var(--border);
          background: var(--surface-subtle);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 6px;
          align-content: start;
        }

        .admin-summary-label {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-soft);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .admin-summary-value {
          font-size: 22px;
          font-weight: 800;
          color: var(--text);
          line-height: 1.1;
          word-break: break-word;
        }

        .admin-toolbar {
          display: grid;
          gap: 14px;
        }

        .admin-toolbar-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .admin-groups {
          display: grid;
          gap: 16px;
        }

        .admin-group {
          display: grid;
          gap: 16px;
        }

        .admin-group-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .admin-group-title {
          margin: 0 0 4px 0;
          color: var(--text);
        }

        .admin-group-subtitle {
          margin: 0;
          color: var(--text-soft);
          font-size: 13px;
          max-width: 900px;
        }

        .admin-group-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          padding: 6px 12px;
          border-radius: 999px;
          background: var(--surface-muted);
          border: 1px solid var(--border);
          color: var(--text);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .admin-link-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
        }

        .admin-link-card {
          display: grid;
          gap: 10px;
          text-decoration: none;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px;
          box-shadow: var(--shadow-sm);
          transition:
            background 120ms ease,
            border-color 120ms ease,
            box-shadow 120ms ease,
            transform 120ms ease;
        }

        .admin-link-card:hover {
          background: var(--surface-subtle);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .admin-link-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .admin-link-title {
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
          line-height: 1.2;
        }

        .admin-link-arrow {
          color: var(--brand-blue);
          font-size: 18px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .admin-link-description {
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .admin-link-footer {
          color: var(--brand-blue);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        @media (max-width: 1180px) {
          .admin-hero {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .admin-hero-side {
            grid-template-columns: 1fr;
          }

          .admin-toolbar-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .admin-toolbar-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}