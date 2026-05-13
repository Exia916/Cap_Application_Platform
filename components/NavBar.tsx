"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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

type MenuItem = {
  href?: string;
  label: string;
  show?: boolean;
  kind?: "link" | "section";
};

type OpenMenu =
  | null
  | "production"
  | "recut"
  | "maintenance"
  | "manager"
  | "admin"
  | "more"
  | "user";

export default function NavBar() {
  const pathname = usePathname() || "";
  const router = useRouter();

  const isLoginPage = pathname === "/login";

  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  

  const [globalQ, setGlobalQ] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // Added for interaction feedback
  const menusWrapRef = useRef<HTMLDivElement | null>(null);

  const [navMode, setNavMode] = useState<"wide" | "medium" | "small">("wide");

  

  useEffect(() => {
    function compute() {
      const w = window.innerWidth || 1400;
      if (w < 768) setNavMode("small");
      else if (w < 1400) setNavMode("medium");
      else setNavMode("wide");
    }

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const res = await fetch("/api/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (res.status === 401) {
          setMe(null);
          setMeLoaded(true);
          return;
        }

        if (!res.ok) {
          setMe(null);
          setMeLoaded(true);
          return;
        }

        const data = (await res.json()) as Me;

        if (!alive) return;
        setMe(data);
        setMeLoaded(true);
      } catch {
        if (!alive) return;
        setMe(null);
        setMeLoaded(true);
      }
    }

    loadMe();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    async function refreshMe() {
      try {
        const res = await fetch("/api/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 401) {
          setMe(null);
          setMeLoaded(true);
          return;
        }

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as Me;
        setMe(data);
        setMeLoaded(true);
      } catch {
        // keep current state on transient failures
      }
    }

    function onFocus() {
      refreshMe();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshMe();
      }
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = menusWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpenMenu(null);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Close mobile menu and reset loading on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setIsNavigating(false); // Reset feedback when page changes
  }, [pathname]);

  const display = useMemo(
    () =>
      me?.displayName?.trim() ||
      me?.username?.trim() ||
      (me?.employeeNumber != null ? `#${me.employeeNumber}` : ""),
    [me?.displayName, me?.username, me?.employeeNumber]
  );

  const role = useMemo(() => (me?.role ?? "").trim().toUpperCase(), [me?.role]);
  const username = useMemo(() => (me?.username ?? "").trim().toLowerCase(), [me?.username]);

  const GLOBAL_SEARCH_ROLES = [
    "ADMIN",
    "SUPERVISOR",
    "MANAGER",
    "PURCHASING",
    "SALES",
  ] as const;

  const isAdmin = role === "ADMIN" || username === "admin";
  const isManager = isAdmin || role === "MANAGER" || role === "SUPERVISOR";

  const canGlobalSearch = GLOBAL_SEARCH_ROLES.includes(role as any);

    const DESIGN_LOOKUP_ROLES = [
    "ADMIN",
    "MANAGER",
    "SUPERVISOR",
    "CUSTOMER SERVICE",
    "OVERSEAS CUSTOMER SERVICE",
    "SALES",
    "PURCHASING",
    "ART",
    "DIGITIZING",
    "ORDER PROCESSING",
    "USER",
    "WAREHOUSE",
  ] as const;

  const canSeeProduction =
  meLoaded &&
  (isAdmin ||
    role === "SUPERVISOR" ||
    role === "MANAGER" ||
    role === "USER" ||
    role === "SALES");

  const canSeeDesignLookup =
    meLoaded && (isAdmin || DESIGN_LOOKUP_ROLES.includes(role as any));

  const canSeeRepairRequests =
    meLoaded && (isAdmin || role === "MANAGER" || role === "SUPERVISOR");

  const canSeeCMMS = meLoaded && (isAdmin || role === "TECH");

  const canSeeRecuts =
    meLoaded &&
    (isAdmin || role === "MANAGER" || role === "SUPERVISOR" || role === "USER");

  const canSeeRecutReview =
    meLoaded && (isAdmin || role === "MANAGER" || role === "SUPERVISOR");

  const canSeeWarehouseRecuts =
    meLoaded &&
    (isAdmin ||
      role === "MANAGER" ||
      role === "SUPERVISOR" ||
      role === "WAREHOUSE");

  const canSeeCmmsMasterData = meLoaded && (isAdmin || role === "TECH");
  const canSeeReports = meLoaded && isManager;

  function runGlobalSearch() {
    const q = globalQ.trim();
    if (!q || !canGlobalSearch) return;
    setOpenMenu(null);
    setIsNavigating(true);
    router.push(`/admin/global-search?q=${encodeURIComponent(q)}`);
  }

  function onGlobalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") runGlobalSearch();
    if (e.key === "Escape") setOpenMenu(null);
  }

  const productionItems: MenuItem[] = [
    { href: "/daily-production", label: "Embroidery" },
  { href: "/qc-daily-production", label: "QC" },
  { href: "/emblem-production", label: "Emblem" },
  { href: "/laser-production", label: "Laser" },
  { href: "/knit-production", label: "Knit Production" },
  { href: "/knit-qc", label: "Knit QC" },
  { href: "/production/sample-embroidery", label: "Sample Embroidery" },
  { href: "/platform/work-sessions", label: "Work Sessions" },
  ];

  const recutItems: MenuItem[] = [
    { href: "/recuts", label: "Recuts", show: canSeeRecuts },
    { href: "/recuts/supervisor-review", label: "Supervisor Review", show: canSeeRecutReview },
    { href: "/recuts/warehouse", label: "Warehouse Recuts", show: canSeeWarehouseRecuts },
  ].filter((x) => x.show !== false);

  const maintenanceItems: MenuItem[] = [
    { kind: "section" as const, label: "Operations", show: canSeeRepairRequests || canSeeCMMS },
    { href: "/cmms/repair-requests", label: "Repair Requests", show: canSeeRepairRequests },
    { href: "/cmms", label: "CMMS", show: canSeeCMMS },

    { kind: "section" as const, label: "Configuration", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/priorities", label: "CMMS Priorities", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/statuses", label: "CMMS Statuses", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/issue_catalog", label: "Issue Catalog", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/techs", label: "CMMS Techs", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/wo_types", label: "Work Order Types", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/cmms_departments", label: "CMMS Departments", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/cmms_assets", label: "CMMS Assets", show: canSeeCmmsMasterData },
  ].filter((x) => x.show !== false);

  const managerItems: MenuItem[] = [
  { kind: "section" as const, label: "Manager Tools", show: meLoaded && isManager },
  { href: "/manager", label: "Manager Home", show: meLoaded && isManager },
  { href: "/reports", label: "Reports", show: canSeeReports },
].filter((x) => x.show !== false);

  const adminItems: MenuItem[] = [
    { kind: "section" as const, label: "Administration", show: meLoaded && isAdmin },
    { href: "/admin", label: "Admin Home", show: meLoaded && isAdmin },
    { href: "/admin/users", label: "Admin Users", show: meLoaded && isAdmin },
    { href: "/admin/master-data", label: "Master Data (Lists)", show: meLoaded && isAdmin },
    { href: "/admin/logs", label: "Application Logs", show: meLoaded && isAdmin },
  ].filter((x) => x.show !== false);

  const productionActive = productionItems.some((i) => i.href && isActive(pathname, i.href));
  const recutActive = recutItems.some((i) => i.href && isActive(pathname, i.href));
  const maintenanceActive = maintenanceItems.some((i) => i.href && isActive(pathname, i.href));
  const managerActive = managerItems.some((i) => i.href && isActive(pathname, i.href));
  const adminActive = adminItems.some((i) => i.href && isActive(pathname, i.href));

  function toggle(menu: OpenMenu) {
    setOpenMenu((cur) => (cur === menu ? null : menu));
  }

  function handleNavigate() {
    setOpenMenu(null);
    setIsNavigating(true); // Trigger feedback
  }

  const showHomeAsPrimary = navMode !== "small";
  const showRecutAsPrimary = navMode !== "small";
  const showMaintenanceAsPrimary = navMode === "wide";
  const showManagerAsPrimary = navMode === "wide";
  const showAdminAsPrimary = navMode === "wide";

  const showMore =
    navMode !== "wide" ||
    (!showRecutAsPrimary && recutItems.length > 0) ||
    (!showMaintenanceAsPrimary && maintenanceItems.length > 0) ||
    (!showManagerAsPrimary && managerItems.length > 0) ||
    (!showAdminAsPrimary && adminItems.length > 0);

  const moreSections = useMemo(() => {
    const sections: { title: string; items: MenuItem[] }[] = [];

    if (!showHomeAsPrimary) {
      sections.push({
        title: "Quick Links",
        items: [
          { href: "/dashboard", label: "Home", show: true },
          { href: "/design-workflow", label: "Workflow", show: true },
          {
            href: "/design-lookup",
            label: "Design Lookup",
            show: canSeeDesignLookup,
          },
        ].filter((x) => x.show !== false),
      });
    }

    if (canSeeProduction && productionItems.length > 0) {
  sections.push({ title: "Production", items: productionItems });
}

    if (!showRecutAsPrimary && recutItems.length > 0) {
      sections.push({ title: "Recut", items: recutItems });
    }

    if (!showMaintenanceAsPrimary && maintenanceItems.length > 0) {
      sections.push({ title: "Maintenance", items: maintenanceItems });
    }

    if (!showManagerAsPrimary && managerItems.length > 0) {
      sections.push({ title: "Manager", items: managerItems });
    }

    if (!showAdminAsPrimary && adminItems.length > 0) {
      sections.push({ title: "Admin", items: adminItems });
    }

    return sections;
  }, [
    showHomeAsPrimary,
    showRecutAsPrimary,
    showMaintenanceAsPrimary,
    showManagerAsPrimary,
    showAdminAsPrimary,
    productionItems,
    recutItems,
    maintenanceItems,
    managerItems,
    adminItems,
  ]);

  if (isLoginPage) {
    return (
      <nav style={loginNav}>
        <Link
          href="/login"
          style={loginBrandWrap}
          title="Cap America - Cap Application Platform"
        >
          <Image
            src="/brand/ca-mark.jpg"
            alt="Cap America"
            width={32}
            height={32}
            priority
            style={{ objectFit: "contain" }}
          />

          <span style={brandTitle}>CAP | Cap Application Platform</span>
        </Link>
      </nav>
    );
  }

  return (
    <nav style={navMode === "small" ? { ...nav, flexDirection: "column", padding: 0 } : nav}>

      {/* Loading Progress Bar Indicator */}
      {isNavigating && <div style={loadingBar} />}

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div
        ref={menusWrapRef}
        style={
          navMode === "small"
            ? { ...navInner, maxWidth: "none", padding: "10px 16px" }
            : navInner
        }
      >
        {/* Left: brand + desktop nav */}
        <div style={left}>
          <Link 
            href="/dashboard" 
            style={brandWrap} 
            title="Cap America - Cap Application Platform"
            onClick={handleNavigate}
          >
            <Image
              src="/brand/ca-mark.jpg"
              alt="Cap America"
              width={32}
              height={32}
              priority
              style={{ objectFit: "contain" }}
            />
            {navMode !== "small" ? (
              <span style={brandTitle}>CAP | Cap Application Platform</span>
            ) : null}
          </Link>

          {/* Desktop-only nav items */}
          {navMode !== "small" ? (
            <>
              {showHomeAsPrimary ? (
                <NavLink href="/dashboard" label="Home" pathname={pathname} onClick={handleNavigate} />
              ) : null}

              <NavLink href="/design-workflow" label="Workflow" pathname={pathname} onClick={handleNavigate} />

              {canSeeDesignLookup ? (
                <NavLink
                  href="/design-lookup"
                  label="Design Lookup"
                  pathname={pathname}
                  onClick={handleNavigate}
                />
              ) : null}

              {canSeeProduction && productionItems.length > 0 ? (
                <Dropdown
                  label="Production"
                  active={productionActive}
                  open={openMenu === "production"}
                  onToggle={() => toggle("production")}
                  items={productionItems}
                  pathname={pathname}
                  onNavigate={() => setOpenMenu(null)}
                />
              ) : null}
              

              {showRecutAsPrimary && recutItems.length > 0 ? (
                <Dropdown
                  label="Recut"
                  active={recutActive}
                  open={openMenu === "recut"}
                  onToggle={() => toggle("recut")}
                  items={recutItems}
                  pathname={pathname}
                  onNavigate={handleNavigate}
                />
              ) : null}

              {showMaintenanceAsPrimary && maintenanceItems.length > 0 ? (
                <Dropdown
                  label="Maintenance"
                  active={maintenanceActive}
                  open={openMenu === "maintenance"}
                  onToggle={() => toggle("maintenance")}
                  items={maintenanceItems}
                  pathname={pathname}
                  onNavigate={handleNavigate}
                />
              ) : null}

              {showManagerAsPrimary && managerItems.length > 0 ? (
                <Dropdown
                  label="Manager"
                  active={managerActive}
                  open={openMenu === "manager"}
                  onToggle={() => toggle("manager")}
                  items={managerItems}
                  pathname={pathname}
                  onNavigate={handleNavigate}
                />
              ) : null}

              {showAdminAsPrimary && adminItems.length > 0 ? (
                <Dropdown
                  label="Admin"
                  active={adminActive}
                  open={openMenu === "admin"}
                  onToggle={() => toggle("admin")}
                  items={adminItems}
                  pathname={pathname}
                  onNavigate={handleNavigate}
                />
              ) : null}

              {showMore ? (
                <MoreMenu
                  open={openMenu === "more"}
                  active={
                    (!showRecutAsPrimary && recutActive) ||
                    (!showMaintenanceAsPrimary && maintenanceActive) ||
                    (!showManagerAsPrimary && managerActive) ||
                    (!showAdminAsPrimary && adminActive) ||
                    (!showHomeAsPrimary && isActive(pathname, "/dashboard"))
                  }
                  onToggle={() => toggle("more")}
                  sections={moreSections}
                  pathname={pathname}
                  onNavigate={handleNavigate}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {/* Right: search, user pill, hamburger */}
        <div style={right}>
          {/* Desktop global search */}
          {navMode !== "small" && meLoaded && canGlobalSearch ? (
            <div
              style={{
                ...searchWrap,
                width: searchFocused ? 360 : 240,
                transition: "width 0.2s ease",
              }}
              title="Global search"
            >
              <input
                value={globalQ}
                onChange={(e) => setGlobalQ(e.target.value)}
                onKeyDown={onGlobalKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search SO, name, notes…"
                style={searchInput}
              />
              <button onClick={runGlobalSearch} style={searchBtn}>
                Search
              </button>
            </div>
          ) : null}

          {/* Mobile inline search — expands on icon click */}
          {navMode === "small" && meLoaded && canGlobalSearch ? (
            mobileSearchOpen ? (
              <div style={{ ...searchWrap, flex: 1 }}>
                <input
                  value={globalQ}
                  onChange={(e) => setGlobalQ(e.target.value)}
                  onKeyDown={onGlobalKeyDown}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search SO, name, notes…"
                  style={{ ...searchInput, flex: 1, minWidth: 0 }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <button onClick={runGlobalSearch} style={searchBtn}>
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setGlobalQ("");
                  }}
                  style={{ ...searchBtn, padding: "0 10px" }}
                  aria-label="Close search"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                style={mobileIconBtn}
                onClick={() => setMobileSearchOpen(true)}
                title="Search"
                aria-label="Open search"
              >
                🔍
              </button>
            )
          ) : null}

          {/* User pill — hide when mobile search is open */}
          {!mobileSearchOpen ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                style={{
                  ...userPillBtn,
                  ...(openMenu === "user" ? pillOpen : {}),
                }}
                onClick={() => toggle("user")}
                aria-expanded={openMenu === "user"}
                aria-haspopup="menu"
                title="User menu"
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={navMode === "small" ? userPillTextMobile : userPillText}
                  >
                    {meLoaded ? display || "Unknown" : "…"}
                  </span>
                  <span style={chev} aria-hidden>
                    ▾
                  </span>
                </span>
              </button>

              {openMenu === "user" ? (
                <div
                  style={{
                    ...menuPanel,
                    ...(navMode === "small" ? { right: 0, left: "auto" } : {}),
                  }}
                  role="menu"
                  aria-label="User menu"
                >
                  <div style={menuHeader}>
                    <div style={menuUserName}>{meLoaded ? display || "Unknown" : "…"}</div>
                    <div style={menuUserMeta}>{meLoaded ? (role ? role : "USER") : ""}</div>
                  </div>

                  <div style={menuDivider} />

                  <Link
                    href="/account"
                    role="menuitem"
                    style={menuItem}
                    onClick={handleNavigate}
                  >
                    My Account
                  </Link>

                  <Link
                    href="/playbooks"
                    role="menuitem"
                    style={menuItem}
                    onClick={handleNavigate}
                  >
                    Playbooks
                  </Link>

                  <div style={menuDivider} />

                  <Link
                    href="/logout"
                    role="menuitem"
                    style={menuItemDanger}
                    onClick={() => {
                      setMe(null);
                      setMeLoaded(false);
                      setOpenMenu(null);
                      setIsNavigating(true);
                    }}
                  >
                    Logout
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Hamburger — mobile only, hidden while search is open */}
          {navMode === "small" && !mobileSearchOpen ? (
            <button
              type="button"
              style={hamburgerBtn}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Mobile full-width dropdown panel ─────────────────────── */}
      {navMode === "small" && mobileMenuOpen ? (
        <div style={mobilePanelStyle}>
          <MobileNavPanel
            sections={[
              {
                title: "Quick Links",
                items: [
                  { href: "/dashboard", label: "Home", show: true },
                  { href: "/design-workflow", label: "Workflow", show: true },
                ],
              },
              ...(canSeeProduction && productionItems.length > 0
  ? [{ title: "Production", items: productionItems }]
  : []),
              ...(recutItems.length > 0 ? [{ title: "Recut", items: recutItems }] : []),
              ...(maintenanceItems.length > 0
                ? [{ title: "Maintenance", items: maintenanceItems }]
                : []),
              ...(managerItems.length > 0 ? [{ title: "Manager", items: managerItems }] : []),
              ...(adminItems.length > 0 ? [{ title: "Admin", items: adminItems }] : []),
            ]}
            pathname={pathname}
            onNavigate={handleNavigate}
          />
        </div>
      ) : null}
    </nav>
  );
}

function NavLink({
  href,
  label,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  pathname: string;
  onClick: () => void;
}) {
  const active = isActive(pathname, href);
  return (
    <Link href={href} style={{ ...link, ...(active ? activeLink : {}) }} onClick={onClick}>
      {label}
    </Link>
  );
}

function Dropdown({
  label,
  items,
  pathname,
  open,
  active,
  onToggle,
  onNavigate,
}: {
  label: string;
  items: MenuItem[];
  pathname: string;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const visibleItems = items.filter((it) => it.show !== false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          ...dropBtn,
          ...(active ? dropBtnActive : {}),
          ...(open ? dropBtnOpen : {}),
        }}
        onClick={() => {
          onToggle();
        }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {label}
          <span style={chev} aria-hidden>
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div style={menuPanel} role="menu" aria-label={`${label} menu`}>
          {visibleItems.map((it, idx) => {
            if (it.kind === "section") {
              const hasPrevVisibleLink = visibleItems
                .slice(0, idx)
                .some((x) => x.kind !== "section");

              return (
                <div key={`section:${it.label}`}>
                  {hasPrevVisibleLink ? <div style={menuDivider} /> : null}
                  <div style={menuSectionTitle}>{it.label}</div>
                </div>
              );
            }

            const href = it.href || "#";
            const a = isActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                style={{ ...menuItem, ...(a ? menuItemActive : {}) }}
                onClick={onNavigate}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MoreMenu({
  open,
  active,
  onToggle,
  sections,
  pathname,
  onNavigate,
}: {
  open: boolean;
  active: boolean;
  onToggle: () => void;
  sections: { title: string; items: MenuItem[] }[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          ...dropBtn,
          ...(active ? dropBtnActive : {}),
          ...(open ? dropBtnOpen : {}),
        }}
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          More
          <span style={chev} aria-hidden>
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div style={{ ...menuPanel, minWidth: 280 }} role="menu" aria-label="More menu">
          {sections.map((sec, idx) => (
            <div key={sec.title} style={{ padding: "6px 6px 2px 6px" }}>
              <div style={menuSectionTitle}>{sec.title}</div>

              <div style={{ marginTop: 4 }}>
                {sec.items
                  .filter((it) => it.show !== false)
                  .map((it, itemIdx, arr) => {
                    if (it.kind === "section") {
                      const hasPrevVisibleLink = arr
                        .slice(0, itemIdx)
                        .some((x) => x.kind !== "section");

                      return (
                        <div key={`more-section:${sec.title}:${it.label}`}>
                          {hasPrevVisibleLink ? <div style={menuDivider} /> : null}
                          <div style={menuSectionTitle}>{it.label}</div>
                        </div>
                      );
                    }

                    const href = it.href || "#";
                    const a = isActive(pathname, href);

                    return (
                      <Link
                        key={`${sec.title}:${href}`}
                        href={href}
                        role="menuitem"
                        style={{ ...menuItem, ...(a ? menuItemActive : {}) }}
                        onClick={onNavigate}
                      >
                        {it.label}
                      </Link>
                    );
                  })}
              </div>

              {idx < sections.length - 1 ? <div style={menuDivider} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileNavPanel({
  sections,
  pathname,
  onNavigate,
}: {
  sections: { title: string; items: MenuItem[] }[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div>
      {sections.map((sec, idx) => {
        const visibleItems = sec.items.filter((it) => it.show !== false);
        if (visibleItems.length === 0) return null;

        return (
          <div key={sec.title}>
            {idx > 0 ? <div style={menuDivider} /> : null}
            <div style={{ ...menuSectionTitle, padding: "10px 16px 6px" }}>{sec.title}</div>
            {visibleItems.map((it, itemIdx) => {
              if (it.kind === "section") {
                return (
                  <div
                    key={`mobile-sec:${it.label}:${itemIdx}`}
                    style={{
                      ...menuSectionTitle,
                      paddingLeft: 24,
                      fontSize: 11,
                    }}
                  >
                    {it.label}
                  </div>
                );
              }

              const href = it.href || "#";
              const active = isActive(pathname, href);

              return (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  style={{
                    ...menuItem,
                    ...(active ? menuItemActive : {}),
                    padding: "0 16px",
                    minHeight: 44,
                    fontSize: 15,
                  }}
                  onClick={onNavigate}
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const loginNav: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: 56,
  padding: "10px 24px",
  background: "linear-gradient(180deg,#ffffff 0%,#f9fafb 100%)",
  borderBottom: "2px solid #b91c1c",
};

const loginBrandWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
};

const nav: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  display: "flex",
  justifyContent: "center",
  padding: "10px 24px",
  background: "linear-gradient(180deg,#ffffff 0%,#f9fafb 100%)",
  borderBottom: "2px solid #b91c1c",
};

const navInner: React.CSSProperties = {
  width: "100%",
  maxWidth: "none",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
};

const left: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
};

const right: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexShrink: 0,
};

const brandWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginRight: 8,
  textDecoration: "none",
  paddingRight: 8,
};

const brandTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#111827",
  whiteSpace: "nowrap",
};

const link: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "#111827",
  fontWeight: 700,
  fontSize: 14,
  whiteSpace: "nowrap",
};

const activeLink: React.CSSProperties = {
  background: "rgba(34, 68, 139, 0.1)",
  color: "#1d4ed8",
};

const dropBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  background: "transparent",
  color: "#111827",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dropBtnActive: React.CSSProperties = {
  background: "rgba(34, 68, 139, 0.1)",
  color: "#1d4ed8",
};

const dropBtnOpen: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  boxShadow: "0 8px 24px rgba(17,24,39,0.08)",
};

const chev: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1,
};

const menuPanel: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  minWidth: 240,
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: 14,
  boxShadow: "0 12px 30px rgba(17,24,39,0.12)",
  padding: 6,
  zIndex: 60,
};

const menuHeader: React.CSSProperties = {
  padding: "10px 12px",
  display: "grid",
  gap: 2,
};

const menuUserName: React.CSSProperties = {
  fontWeight: 800,
  color: "#111827",
  fontSize: 14,
};

const menuUserMeta: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 700,
};

const menuDivider: React.CSSProperties = {
  height: 1,
  background: "#e5e7eb",
  margin: "6px 0",
};

const menuSectionTitle: React.CSSProperties = {
  padding: "8px 10px 6px 10px",
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const menuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: 38,
  padding: "0 10px",
  borderRadius: 10,
  textDecoration: "none",
  color: "#111827",
  fontWeight: 700,
  fontSize: 14,
};

const menuItemActive: React.CSSProperties = {
  background: "rgba(34, 68, 139, 0.08)",
  color: "#1d4ed8",
};

const menuItemDanger: React.CSSProperties = {
  ...menuItem,
  color: "#b91c1c",
};

const searchWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 38,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
};

const searchBtn: React.CSSProperties = {
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

const userPillBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
};

const pillOpen: React.CSSProperties = {
  boxShadow: "0 8px 24px rgba(17,24,39,0.08)",
};

const userPillText: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 13,
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const userPillTextMobile: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 13,
  maxWidth: 90,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mobileIconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  width: 38,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
  fontSize: 16,
};

const hamburgerBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  width: 38,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 700,
};

const mobilePanelStyle: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  borderTop: "1px solid #e5e7eb",
  maxHeight: "calc(100vh - 58px)",
  overflowY: "auto",
  paddingBottom: 16,
};

const loadingBar: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 3,
  backgroundColor: "#1d4ed8",
  zIndex: 100,
  animation: "loading-anim 2s infinite linear",
  transformOrigin: "left",
};

// Add this to your globals.css or a <style> tag
const styleSheet = `
@keyframes loading-anim {
  0% { transform: scaleX(0); }
  50% { transform: scaleX(0.7); }
  100% { transform: scaleX(1); opacity: 0; }
}
`;