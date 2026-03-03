"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

type Me = {
  username: string | null;
  displayName: string | null;
  employeeNumber: number | null;
  role: string | null;
};

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  // Global search state
  const [globalQ, setGlobalQ] = useState("");

  const fetchMe = useCallback(async () => {
    setMeLoaded(false);
    try {
      const res = await fetch("/api/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        setMe(null);
        setMeLoaded(true);
        return;
      }

      const data = (await res.json()) as Me;
      setMe(data);
      setMeLoaded(true);
    } catch {
      setMe(null);
      setMeLoaded(true);
    }
  }, []);

  // 1) initial load + 2) refetch on route change (covers login navigation)
  useEffect(() => {
    fetchMe();
  }, [fetchMe, pathname]);

  // 3) refetch when tab becomes visible again or window regains focus
  useEffect(() => {
    function onFocus() {
      fetchMe();
    }
    function onVis() {
      if (document.visibilityState === "visible") fetchMe();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchMe]);

  const display =
    me?.displayName?.trim() ||
    me?.username?.trim() ||
    (me?.employeeNumber != null ? `#${me.employeeNumber}` : "");

  const role = useMemo(() => (me?.role ?? "").trim().toUpperCase(), [me?.role]);
  const username = useMemo(() => (me?.username ?? "").trim().toLowerCase(), [me?.username]);

  const isAdmin = role === "ADMIN" || username === "admin";
  const isManagerRole = isAdmin || role === "MANAGER" || role === "SUPERVISOR";

  // Global search remains ADMIN/MANAGER only (your current behavior)
  const canGlobalSearch = isAdmin || role === "MANAGER";

  // ✅ CMMS Repair Requests visible to: ADMIN / MANAGER / SUPERVISOR / TECH
  const canSeeRepairRequests =
    meLoaded && (isAdmin || role === "MANAGER" || role === "SUPERVISOR" || role === "TECH");

  function runGlobalSearch() {
    const q = globalQ.trim();
    if (!q) return;
    router.push(`/admin/global-search?q=${encodeURIComponent(q)}`);
  }

  function onGlobalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") runGlobalSearch();
  }

  return (
    <nav style={nav}>
      <div className="NavLink" style={left}>
        <span style={brand}>Cap MES</span>

        <NavLink href="/dashboard" label="Home" pathname={pathname || ""} />
        <NavLink href="/daily-production" label="Embroidery" pathname={pathname || ""} />
        <NavLink href="/qc-daily-production" label="QC" pathname={pathname || ""} />
        <NavLink href="/emblem-production" label="Emblem" pathname={pathname || ""} />
        <NavLink href="/laser-production" label="Laser" pathname={pathname || ""} />

        {/* ✅ NEW: CMMS Repair Request */}
        {canSeeRepairRequests ? (
          <NavLink href="/cmms/repair-requests" label="Repair Request" pathname={pathname || ""} />
        ) : null}

        {/* Manager/Admin hubs */}
        {meLoaded && isManagerRole ? (
          <NavLink href="/manager" label="Manager" pathname={pathname || ""} />
        ) : null}

        {meLoaded && isAdmin ? <NavLink href="/admin" label="Admin" pathname={pathname || ""} /> : null}
      </div>

      {/* Center: Global search (ADMIN/MANAGER only) */}
      <div style={center}>
        {meLoaded && canGlobalSearch ? (
          <div style={searchWrap} title="Global search (Admin/Manager)">
            <input
              value={globalQ}
              onChange={(e) => setGlobalQ(e.target.value)}
              onKeyDown={onGlobalKeyDown}
              placeholder="Global search… (SO, name, notes, etc.)"
              style={searchInput}
            />
            <button onClick={runGlobalSearch} style={searchBtn}>
              Search
            </button>
          </div>
        ) : null}
      </div>

      <div style={right}>
        <span style={userPill}>{meLoaded ? display || "Unknown" : "…"}</span>

        <Link
          href="/logout"
          onClick={() => {
            setMe(null);
            setMeLoaded(false);
          }}
          style={{
            padding: "8px 14px",
            borderRadius: "9999px",
            border: "none",
            background: "#ef4444",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          Logout
        </Link>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      className={`${active ? "active" : ""}`}
      id={`${active ? "active" : ""}`}
      style={{
        ...link,
        ...(active ? activeLink : {}),
      }}
    >
      {label}
    </Link>
  );
}

/* ---------- Styles ---------- */

const nav: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 24px",
  borderBottom: "1px solid #ddd",
  background: "#fff",
  gap: 16,
};

const left: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  minWidth: 520,
};

const center: React.CSSProperties = {
  flex: 1,
  display: "flex",
  justifyContent: "center",
};

const right: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  minWidth: 220,
  justifyContent: "flex-end",
};

const brand: React.CSSProperties = {
  fontWeight: 600,
  marginRight: 16,
};

const link: React.CSSProperties = {
  textDecoration: "none",
  padding: "6px 10px",
  borderRadius: 6,
  color: "#000",
};

const activeLink: React.CSSProperties = {
  backgroundColor: "#f0f0f0",
  color: "#000!important",
  fontWeight: 600,
};

const userPill: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "#fafafa",
  minWidth: 90,
  textAlign: "center",
};

/* Global search UI */
const searchWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 6,
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "#fff",
  minWidth: 420,
};

const searchInput: React.CSSProperties = {
  border: "none",
  outline: "none",
  fontSize: 13,
  padding: "6px 10px",
  width: 330,
};

const searchBtn: React.CSSProperties = {
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};