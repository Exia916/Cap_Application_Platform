"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MeResponse = {
  username?: string | null;
  role?: string | null;
};

type QuickAction = {
  href: string;
  label: string;
};

function getQuickActions(role: string, username: string): QuickAction[] {
  const isAdmin = role === "ADMIN" || username === "admin";
  const isManager = isAdmin || role === "MANAGER";
  const isSupervisor = isManager || role === "SUPERVISOR";

  const maintenanceHref = isSupervisor ? "/cmms/repair-requests" : null;
  const recutsHref = isSupervisor ? "/recuts/supervisor-review" : "/recuts";

  if (isAdmin) {
    return [
      { href: "/manager", label: "Manager Workspace" },
      { href: "/admin", label: "Admin Workspace" },
      { href: "/sales-orders", label: "Sales Order Lookup" },
      { href: recutsHref, label: "Recut Review" },
      { href: "/admin/master-data", label: "Master Data" },
      { href: "/admin/users", label: "Users" },
      ...(maintenanceHref ? [{ href: maintenanceHref, label: "Maintenance" }] : []),
    ];
  }

  if (isManager) {
    return [
      { href: "/manager", label: "Manager Workspace" },
      { href: "/sales-orders", label: "Sales Order Lookup" },
      { href: recutsHref, label: "Recut Review" },
      { href: "/recuts/warehouse", label: "Warehouse Recuts" },
      { href: "/daily-production", label: "Daily Production" },
      { href: "/knit-production", label: "Knit Production" },
      ...(maintenanceHref ? [{ href: maintenanceHref, label: "Maintenance" }] : []),
    ];
  }

  if (isSupervisor) {
    return [
      { href: "/sales-orders", label: "Sales Order Lookup" },
      { href: recutsHref, label: "Recut Review" },
      { href: "/daily-production", label: "Daily Production" },
      { href: "/qc-daily-production", label: "QC Daily" },
      { href: "/emblem-production", label: "Emblem" },
      { href: "/laser-production", label: "Laser" },
      ...(maintenanceHref ? [{ href: maintenanceHref, label: "Maintenance" }] : []),
    ];
  }

  return [
    { href: "/sales-orders", label: "Sales Order Lookup" },
    { href: "/daily-production/add", label: "New Daily Production" },
    { href: "/qc-daily-production/add", label: "New QC Entry" },
    { href: "/production/sample-embroidery/add", label: "New Sample Embroidery" },
    { href: recutsHref, label: "Recuts" },
  ];
}

export default function QuickActionsCard() {
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

  const actions = useMemo(() => getQuickActions(role, username), [role, username]);

  return (
    <section className="card">
      <div className="section-card-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Quick Actions</h2>
          <div className="text-soft">Jump into the most common next steps for your role.</div>
        </div>
      </div>

      <div className="dashboard-quick-actions-grid">
        {actions.map((action) => (
          <Link key={`${action.href}-${action.label}`} href={action.href} className="dashboard-action-tile">
            <span className="dashboard-action-label">{action.label}</span>
            <span className="dashboard-action-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>

      <style jsx global>{`
        .dashboard-quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .dashboard-action-tile {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 52px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          text-decoration: none;
          font-weight: 700;
          box-shadow: var(--shadow-sm);
          transition:
            background 120ms ease,
            border-color 120ms ease,
            box-shadow 120ms ease,
            transform 120ms ease;
        }

        .dashboard-action-tile:hover {
          background: var(--surface-subtle);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .dashboard-action-label {
          line-height: 1.2;
        }

        .dashboard-action-arrow {
          color: var(--brand-blue);
          font-size: 18px;
          font-weight: 800;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .dashboard-quick-actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}