"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  role?: string | null;
};

function getRoleLabel(role: string, username: string) {
  if (role === "ADMIN" || username === "admin") return "Administrator";
  if (role === "MANAGER") return "Manager";
  if (role === "SUPERVISOR") return "Supervisor";
  if (role === "USER") return "User";
  return "Team Member";
}

function getRoleMessage(role: string, username: string) {
  if (role === "ADMIN" || username === "admin") {
    return "Use the dashboard as your starting point for platform administration, work areas, and sales order lookup.";
  }
  if (role === "MANAGER") {
    return "Use the dashboard as your starting point for oversight work, production areas, and sales order lookup.";
  }
  if (role === "SUPERVISOR") {
    return "Use the dashboard as your starting point for review work, production areas, and sales order lookup.";
  }
  return "Use the dashboard as your starting point for production entries, work areas, and sales order lookup.";
}

export default function WelcomeCard() {
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
    () => me?.displayName?.trim() || me?.username?.trim() || "User",
    [me?.displayName, me?.username]
  );

  const roleLabel = getRoleLabel(role, username);
  const roleMessage = getRoleMessage(role, username);

  return (
    <section className="card card-lg dashboard-welcome-card">
      <div className="dashboard-welcome-main">
        <div className="dashboard-kicker">Home Workspace</div>
        <h1 className="dashboard-title">Welcome, {displayName}</h1>
        <p className="dashboard-subtitle">
          {loaded ? roleMessage : "Loading your dashboard workspace..."}
        </p>

        <div className="dashboard-welcome-actions">
          <Link href="/sales-orders" className="btn btn-primary">
            Sales Order Lookup
          </Link>

          <Link href="/recuts" className="btn btn-secondary">
            Open Recuts
          </Link>

          <Link href="/dashboard/metrics" className="btn btn-secondary">
            My Metrics
          </Link>
        </div>
      </div>

      <div className="dashboard-welcome-side">
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-label">Role</div>
          <div className="dashboard-summary-value">{loaded ? roleLabel : "..."}</div>
        </div>

        <div className="dashboard-summary-card">
          <div className="dashboard-summary-label">Home</div>
          <div className="dashboard-summary-value">Dashboard</div>
        </div>
      </div>

      <style jsx global>{`
        .dashboard-welcome-card {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.8fr);
          gap: 20px;
          align-items: stretch;
        }

        .dashboard-welcome-main {
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .dashboard-kicker {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-soft);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .dashboard-title {
          margin: 0;
          color: var(--text);
        }

        .dashboard-subtitle {
          margin: 0;
          color: var(--text-muted);
          font-size: 14px;
          max-width: 900px;
        }

        .dashboard-welcome-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 4px;
        }

        .dashboard-welcome-side {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .dashboard-summary-card {
          border: 1px solid var(--border);
          background: var(--surface-subtle);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 6px;
          align-content: start;
        }

        .dashboard-summary-label {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-soft);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .dashboard-summary-value {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          line-height: 1.1;
          word-break: break-word;
        }

        @media (max-width: 980px) {
          .dashboard-welcome-card {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .dashboard-welcome-side {
            grid-template-columns: 1fr;
          }

          .dashboard-welcome-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .dashboard-welcome-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}