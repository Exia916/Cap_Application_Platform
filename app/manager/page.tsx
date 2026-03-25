"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  role?: string | null;
};

type ShortcutItem = {
  href: string;
  title: string;
  description: string;
};

type ShortcutGroup = {
  title: string;
  subtitle: string;
  items: ShortcutItem[];
};

export default function ManagerPage() {
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
    () => me?.displayName?.trim() || me?.username?.trim() || "Manager",
    [me?.displayName, me?.username]
  );

  const isAdmin = role === "ADMIN" || username === "admin";
  const isManagerRole = isAdmin || role === "MANAGER" || role === "SUPERVISOR";

  useEffect(() => {
    if (!loaded) return;
    if (!isManagerRole) router.replace("/dashboard");
  }, [loaded, isManagerRole, router]);

  const groups: ShortcutGroup[] = [
    {
      title: "Embroidery",
      subtitle: "Cross-user review and all-entry visibility for embroidery production.",
      items: [
        {
          href: "/admin/daily-production-all",
          title: "Daily Production (All)",
          description: "Review all embroidery daily production entries across users.",
        },
        {
          href: "/admin/sample-embroidery-all",
          title: "Sample Embroidery (All)",
          description: "Review all sample embroidery submissions in one place.",
        },
      ],
    },
    {
      title: "Emblems",
      subtitle: "Manager oversight for QC, emblem, and laser activity.",
      items: [
        {
          href: "/admin/qc-daily-production-all",
          title: "QC Daily (All)",
          description: "Review all QC daily production entries across users.",
        },
        {
          href: "/admin/emblem-production-all",
          title: "Emblem (All)",
          description: "Review all emblem production records and submissions.",
        },
        {
          href: "/admin/laser-production-all",
          title: "Laser (All)",
          description: "Review all laser production records and activity.",
        },
      ],
    },
    {
      title: "Knits",
      subtitle: "Manager access to knit production and knit QC all-views.",
      items: [
        {
          href: "/admin/knit-production-all",
          title: "Knit Production (All)",
          description: "Review all knit production submissions across users.",
        },
        {
          href: "/admin/knit-qc-all",
          title: "Knit QC (All)",
          description: "Review all knit QC submissions and records.",
        },
      ],
    },
  ];

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card">
          <div className="text-muted">Loading manager workspace…</div>
        </div>
      </div>
    );
  }

  if (!isManagerRole) return null;

  return (
    <div className="page-shell-wide">
      <div className="manager-page">
        <header className="manager-hero card card-lg">
          <div className="manager-hero-main">
            <div className="manager-kicker">Manager Workspace</div>
            <h1 className="manager-title">Manager Landing Page</h1>
            <p className="manager-subtitle">
              Welcome, <strong>{displayName}</strong>. Use this page to access grouped
              all-view production areas and common oversight tools.
            </p>
          </div>
        </header>

        <section className="manager-toolbar card">
          <div className="section-card-header" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>Quick Tools</h2>
              <div className="text-soft">
                Common manager and oversight destinations.
              </div>
            </div>
          </div>

          <div className="manager-toolbar-actions">
            <Link href="/dashboard" className="btn btn-secondary">
              Home
            </Link>

            <Link href="/sales-orders" className="btn btn-secondary">
              Sales Order Lookup
            </Link>

            <Link href="/recuts/supervisor-review" className="btn btn-secondary">
              Recut Supervisor Review
            </Link>

            <Link href="/recuts/warehouse" className="btn btn-secondary">
              Warehouse Recuts
            </Link>

             <Link href="/platform/work-sessions" className="btn btn-secondary">
              Work Sessions
            </Link>
          </div>
        </section>

        <section className="manager-groups">
          {groups.map((group) => (
            <div key={group.title} className="manager-group card">
              <div className="manager-group-head">
                <div>
                  <h2 className="manager-group-title">{group.title}</h2>
                  <p className="manager-group-subtitle">{group.subtitle}</p>
                </div>

                <div className="manager-group-count">
                  {group.items.length} {group.items.length === 1 ? "Page" : "Pages"}
                </div>
              </div>

              <div className="manager-link-grid">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="manager-link-card">
                    <div className="manager-link-top">
                      <div className="manager-link-title">{item.title}</div>
                      <div className="manager-link-arrow" aria-hidden="true">
                        →
                      </div>
                    </div>

                    <div className="manager-link-description">{item.description}</div>

                    <div className="manager-link-footer">Open all-view page</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      <style jsx global>{`
        .manager-page {
          display: grid;
          gap: 16px;
        }

        .manager-hero {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: stretch;
        }

        .manager-hero-main {
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .manager-kicker {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-soft);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .manager-title {
          margin: 0;
          color: var(--text);
        }

        .manager-subtitle {
          margin: 0;
          color: var(--text-muted);
          max-width: 900px;
          font-size: 14px;
        }

        .manager-toolbar {
          display: grid;
          gap: 14px;
        }

        .manager-toolbar-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .manager-groups {
          display: grid;
          gap: 16px;
        }

        .manager-group {
          display: grid;
          gap: 16px;
        }

        .manager-group-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .manager-group-title {
          margin: 0 0 4px 0;
          color: var(--text);
        }

        .manager-group-subtitle {
          margin: 0;
          color: var(--text-soft);
          font-size: 13px;
          max-width: 900px;
        }

        .manager-group-count {
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

        .manager-link-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
        }

        .manager-link-card {
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

        .manager-link-card:hover {
          background: var(--surface-subtle);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .manager-link-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .manager-link-title {
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
          line-height: 1.2;
        }

        .manager-link-arrow {
          color: var(--brand-blue);
          font-size: 18px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .manager-link-description {
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .manager-link-footer {
          color: var(--brand-blue);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        @media (max-width: 760px) {
          .manager-toolbar-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .manager-toolbar-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}