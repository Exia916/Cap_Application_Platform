"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MeResponse = {
  username?: string | null;
  role?: string | null;
};

type AreaLink = {
  href: string;
  title: string;
  description: string;
};

type AreaGroup = {
  title: string;
  subtitle: string;
  items: AreaLink[];
};

export default function WorkAreasCard() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const json = (await res.json().catch(() => ({}))) as MeResponse;
        if (!cancelled) setMe(json);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const role = useMemo(() => (me?.role ?? "").trim().toUpperCase(), [me?.role]);
  const username = useMemo(() => (me?.username ?? "").trim().toLowerCase(), [me?.username]);

  const isAdmin = role === "ADMIN" || username === "admin";
  const isManager = isAdmin || role === "MANAGER";
  const isSupervisor = isManager || role === "SUPERVISOR";

  const recutsHref = isSupervisor ? "/recuts/supervisor-review" : "/recuts";
  const maintenanceHref = isSupervisor ? "/cmms/repair-requests" : null;

  const groups: AreaGroup[] = useMemo(() => {
    const production: AreaGroup = {
      title: "Production",
      subtitle: "Core production modules and related operational entry areas.",
      items: [
        {
          href: "/daily-production",
          title: "Daily Production",
          description: "Embroidery daily production records and entry pages.",
        },
        {
          href: "/production/sample-embroidery",
          title: "Sample Embroidery",
          description: "Sample embroidery entry, review, and record access.",
        },
        {
          href: "/qc-daily-production",
          title: "QC Daily",
          description: "QC daily production entry and review area.",
        },
        {
          href: "/emblem-production",
          title: "Emblem",
          description: "Emblem production entry and record pages.",
        },
        {
          href: "/laser-production",
          title: "Laser",
          description: "Laser production entry and record pages.",
        },
        {
          href: "/knit-production",
          title: "Knit Production",
          description: "Knit production records and entry pages.",
        },
        {
          href: "/knit-qc",
          title: "Knit QC",
          description: "Knit QC records and entry pages.",
        },
      ],
    };

    const operationalSupport: AreaGroup = {
      title: "Operational Support",
      subtitle: "Cross-functional support areas and process follow-up pages.",
      items: [
        {
          href: recutsHref,
          title: "Recuts",
          description: "Open recut entry, review, and follow-up records.",
        },
        ...(maintenanceHref
          ? [
              {
                href: maintenanceHref,
                title: "Maintenance",
                description: "Maintenance work areas and service tracking pages.",
              },
            ]
          : []),
      ],
    };

    const roleTools: AreaGroup = {
      title: "Role Tools",
      subtitle: "Workspace pages available based on access level.",
      items: [
        ...(isSupervisor
          ? [
              {
                href: "/manager",
                title: "Manager Workspace",
                description: "Grouped manager oversight and all-view landing page.",
              },
            ]
          : []),
        ...(isAdmin
          ? [
              {
                href: "/admin",
                title: "Admin Workspace",
                description: "Administrative tools, user management, and master data access.",
              },
            ]
          : []),
      ],
    };

    return [production, operationalSupport, roleTools].filter(
      (group) => group.items.length > 0
    );
  }, [isAdmin, isSupervisor, recutsHref, maintenanceHref]);

  return (
    <section className="card">
      <div className="section-card-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Work Areas</h2>
          <div className="text-soft">Navigate by business area instead of hunting through menus.</div>
        </div>
      </div>

      <div className="dashboard-area-groups">
        {groups.map((group) => (
          <div key={group.title} className="dashboard-area-group">
            <div className="dashboard-area-head">
              <div>
                <h3 className="dashboard-area-title">{group.title}</h3>
                <p className="dashboard-area-subtitle">{group.subtitle}</p>
              </div>
              <div className="dashboard-area-count">
                {group.items.length} {group.items.length === 1 ? "Area" : "Areas"}
              </div>
            </div>

            <div className="dashboard-area-grid">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className="dashboard-area-card">
                  <div className="dashboard-area-card-top">
                    <div className="dashboard-area-card-title">{item.title}</div>
                    <div className="dashboard-area-card-arrow" aria-hidden="true">
                      →
                    </div>
                  </div>

                  <div className="dashboard-area-card-description">{item.description}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .dashboard-area-groups {
          display: grid;
          gap: 18px;
          margin-top: 14px;
        }

        .dashboard-area-group {
          display: grid;
          gap: 14px;
          padding-top: 2px;
        }

        .dashboard-area-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .dashboard-area-title {
          margin: 0 0 4px 0;
          color: var(--text);
        }

        .dashboard-area-subtitle {
          margin: 0;
          color: var(--text-soft);
          font-size: 13px;
          max-width: 900px;
        }

        .dashboard-area-count {
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

        .dashboard-area-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .dashboard-area-card {
          display: grid;
          gap: 8px;
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

        .dashboard-area-card:hover {
          background: var(--surface-subtle);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .dashboard-area-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .dashboard-area-card-title {
          font-size: 15px;
          font-weight: 800;
          color: var(--text);
          line-height: 1.2;
        }

        .dashboard-area-card-arrow {
          color: var(--brand-blue);
          font-size: 18px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .dashboard-area-card-description {
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.4;
        }
      `}</style>
    </section>
  );
}