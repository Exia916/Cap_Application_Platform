"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ModuleAccess = {
  id: string | null;
  moduleKey: string;
  canView: boolean;
  canAssignSelf: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canNote: boolean;
  canComplete: boolean;
  isActive: boolean;
};

type PartnerUser = {
  id: string;
  partnerId: string;
  userId: string;
  username: string;
  displayName: string | null;
  name: string | null;
  email: string | null;
  capRole: string | null;
  department: string | null;
  userIsActive: boolean;
  externalRole: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Partner = {
  id: string;
  code: string;
  name: string;
  partnerType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  activeUserCount: number;
  moduleAccess: ModuleAccess[];
  users: PartnerUser[];
};

type AvailableUser = {
  id: string;
  username: string;
  displayName: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  isActive: boolean;
  externalPartnerId: string | null;
  externalPartnerCode: string | null;
  externalPartnerName: string | null;
  externalRole: string | null;
  externalLinkIsActive: boolean | null;
};

type MeResponse = {
  role?: string | null;
  username?: string | null;
  displayName?: string | null;
};

type PartnerDraft = {
  name: string;
  partnerType: string;
  isActive: boolean;
};

type LinkDraft = {
  userId: string;
  externalRole: string;
};

const MODULE_KEY = "design_workflow";

const DEFAULT_ACCESS: ModuleAccess = {
  id: null,
  moduleKey: MODULE_KEY,
  canView: true,
  canAssignSelf: true,
  canUpload: true,
  canDownload: true,
  canNote: true,
  canComplete: true,
  isActive: true,
};

function emptyAccess(): ModuleAccess {
  return { ...DEFAULT_ACCESS };
}

function partnerTypeLabel(value: string) {
  switch (value) {
    case "WORKFLOW_DESIGN":
      return "Workflow Design";
    case "WORKFLOW_DIGITIZING":
      return "Workflow Digitizing";
    case "PRODUCTION":
      return "Production";
    default:
      return value || "-";
  }
}

function externalRoleLabel(value: string) {
  switch (value) {
    case "EXTERNAL_DESIGNER":
      return "External Designer";
    case "EXTERNAL_DIGITIZER":
      return "External Digitizer";
    case "EXTERNAL_WORKFLOW_PARTNER":
      return "External Workflow Partner";
    case "EXTERNAL_VIEWER":
      return "External Viewer";
    default:
      return value || "-";
  }
}

function displayUser(user: Pick<AvailableUser | PartnerUser, "displayName" | "name" | "username">) {
  return user.displayName || user.name || user.username || "Unknown User";
}

function fmtDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function getWorkflowAccess(partner: Partner): ModuleAccess {
  return partner.moduleAccess.find((item) => item.moduleKey === MODULE_KEY) || emptyAccess();
}

function roleOptionsForPartner(partnerType: string) {
  if (partnerType === "WORKFLOW_DIGITIZING") {
    return [
      { value: "EXTERNAL_DIGITIZER", label: "External Digitizer" },
      { value: "EXTERNAL_WORKFLOW_PARTNER", label: "External Workflow Partner" },
      { value: "EXTERNAL_VIEWER", label: "External Viewer" },
    ];
  }

  if (partnerType === "WORKFLOW_DESIGN") {
    return [
      { value: "EXTERNAL_DESIGNER", label: "External Designer" },
      { value: "EXTERNAL_WORKFLOW_PARTNER", label: "External Workflow Partner" },
      { value: "EXTERNAL_VIEWER", label: "External Viewer" },
    ];
  }

  return [
    { value: "EXTERNAL_WORKFLOW_PARTNER", label: "External Workflow Partner" },
    { value: "EXTERNAL_VIEWER", label: "External Viewer" },
  ];
}

function defaultRoleForPartner(partnerType: string) {
  if (partnerType === "WORKFLOW_DIGITIZING") return "EXTERNAL_DIGITIZER";
  if (partnerType === "WORKFLOW_DESIGN") return "EXTERNAL_DESIGNER";
  return "EXTERNAL_WORKFLOW_PARTNER";
}

function boolBadge(value: boolean, trueText = "Active", falseText = "Inactive") {
  return (
    <span className={value ? "badge badge-success" : "badge badge-neutral"}>
      {value ? trueText : falseText}
    </span>
  );
}

export default function ExternalPartnersAdminPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [partnerDrafts, setPartnerDrafts] = useState<Record<string, PartnerDraft>>({});
  const [accessDrafts, setAccessDrafts] = useState<Record<string, ModuleAccess>>({});
  const [linkDrafts, setLinkDrafts] = useState<Record<string, LinkDraft>>({});

  const role = String(me?.role || "").trim().toUpperCase();
  const username = String(me?.username || "").trim().toLowerCase();
  const isAdmin = role === "ADMIN" || username === "admin";

  async function loadAll() {
    setError("");

    const [meRes, partnersRes, usersRes] = await Promise.all([
      fetch("/api/me", { cache: "no-store", credentials: "include" }),
      fetch("/api/admin/external-partners", { cache: "no-store", credentials: "include" }),
      fetch("/api/admin/external-partners/available-users", { cache: "no-store", credentials: "include" }),
    ]);

    const meJson = await meRes.json().catch(() => ({}));
    setMe(meJson as MeResponse);

    const partnersJson = await partnersRes.json().catch(() => ({}));
    if (!partnersRes.ok) throw new Error((partnersJson as any)?.error || "Failed to load external partners");

    const usersJson = await usersRes.json().catch(() => ({}));
    if (!usersRes.ok) throw new Error((usersJson as any)?.error || "Failed to load available users");

    const loadedPartners = ((partnersJson as any).partners || []) as Partner[];
    setPartners(loadedPartners);
    setAvailableUsers(((usersJson as any).users || []) as AvailableUser[]);

    const nextPartnerDrafts: Record<string, PartnerDraft> = {};
    const nextAccessDrafts: Record<string, ModuleAccess> = {};
    const nextLinkDrafts: Record<string, LinkDraft> = {};

    for (const partner of loadedPartners) {
      nextPartnerDrafts[partner.id] = {
        name: partner.name || "",
        partnerType: partner.partnerType || "WORKFLOW_DESIGN",
        isActive: partner.isActive !== false,
      };
      nextAccessDrafts[partner.id] = getWorkflowAccess(partner);
      nextLinkDrafts[partner.id] = {
        userId: "",
        externalRole: defaultRoleForPartner(partner.partnerType),
      };
    }

    setPartnerDrafts(nextPartnerDrafts);
    setAccessDrafts(nextAccessDrafts);
    setLinkDrafts(nextLinkDrafts);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadAll();
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load external partner administration.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;

    return partners.filter((partner) => {
      const haystack = [
        partner.code,
        partner.name,
        partner.partnerType,
        partner.users.map((user) => [user.username, user.displayName, user.name, user.email, user.externalRole].join(" ")).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [partners, search]);

  const activePartnerCount = partners.filter((partner) => partner.isActive).length;
  const activePartnerUserCount = partners.reduce((sum, partner) => sum + Number(partner.activeUserCount || 0), 0);

  function usersForPartnerDropdown(partnerId: string) {
    return availableUsers.filter((user) => !user.externalPartnerId || user.externalPartnerId === partnerId);
  }

  async function savePartner(partnerId: string) {
    const draft = partnerDrafts[partnerId];
    if (!draft) return;

    setSaving(`partner:${partnerId}`);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/external-partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          partnerId,
          name: draft.name,
          partnerType: draft.partnerType,
          isActive: draft.isActive,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Failed to save partner");

      setSuccess("Partner updated.");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Failed to save partner");
    } finally {
      setSaving(null);
    }
  }

  async function saveAccess(partnerId: string) {
    const draft = accessDrafts[partnerId];
    if (!draft) return;

    setSaving(`access:${partnerId}`);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/external-partners/${encodeURIComponent(partnerId)}/module-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...draft, moduleKey: MODULE_KEY }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Failed to save module access");

      setSuccess("Module access updated.");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Failed to save module access");
    } finally {
      setSaving(null);
    }
  }

  async function addUser(partner: Partner) {
    const draft = linkDrafts[partner.id];
    if (!draft?.userId) {
      setError("Select a CAP user to link.");
      return;
    }

    setSaving(`user:add:${partner.id}`);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/external-partners/${encodeURIComponent(partner.id)}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: draft.userId,
          externalRole: draft.externalRole || defaultRoleForPartner(partner.partnerType),
          isActive: true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Failed to link user");

      setSuccess("External partner user linked.");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Failed to link user");
    } finally {
      setSaving(null);
    }
  }

  async function updatePartnerUser(userLink: PartnerUser, changes: Partial<Pick<PartnerUser, "externalRole" | "isActive">>) {
    setSaving(`user:${userLink.id}`);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/external-partners/users/${encodeURIComponent(userLink.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(changes),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Failed to update partner user");

      setSuccess("External partner user updated.");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Failed to update partner user");
    } finally {
      setSaving(null);
    }
  }

  async function deactivatePartnerUser(userLink: PartnerUser) {
    const label = displayUser(userLink);
    if (!confirm(`Deactivate external partner access for ${label}?`)) return;

    setSaving(`user:${userLink.id}`);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/external-partners/users/${encodeURIComponent(userLink.id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Failed to deactivate partner user");

      setSuccess("External partner user deactivated.");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Failed to deactivate partner user");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card">Loading external partner administration…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page-shell">
        <div className="card">
          <h1 className="page-title">Forbidden</h1>
          <p className="page-subtitle">Only Admin users can manage external partner access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div>
          <h1 className="page-title">External Partners</h1>
          <p className="page-subtitle">
            Manage Workflow partner companies, module access, and which CAP users are linked to each partner.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/users" className="btn btn-secondary">
            Admin Users
          </Link>
          <Link href="/partner-work" className="btn btn-secondary">
            Partner Work
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <section className="card" style={{ display: "grid", gap: 12 }}>
        <div className="record-meta-grid">
          <div className="record-meta-item">
            <div className="record-meta-label">Partners</div>
            <div className="record-meta-value">{partners.length}</div>
          </div>
          <div className="record-meta-item">
            <div className="record-meta-label">Active Partners</div>
            <div className="record-meta-value">{activePartnerCount}</div>
          </div>
          <div className="record-meta-item">
            <div className="record-meta-label">Active External Users</div>
            <div className="record-meta-value">{activePartnerUserCount}</div>
          </div>
        </div>

        <div>
          <label htmlFor="partnerSearch" className="record-meta-label">
            Search partners and users
          </label>
          <input
            id="partnerSearch"
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by partner, user, email, or role…"
          />
        </div>
      </section>

      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        {filteredPartners.map((partner) => {
          const partnerDraft = partnerDrafts[partner.id] || {
            name: partner.name,
            partnerType: partner.partnerType,
            isActive: partner.isActive,
          };
          const accessDraft = accessDrafts[partner.id] || getWorkflowAccess(partner);
          const linkDraft = linkDrafts[partner.id] || {
            userId: "",
            externalRole: defaultRoleForPartner(partner.partnerType),
          };
          const dropdownUsers = usersForPartnerDropdown(partner.id);
          const roleOptions = roleOptionsForPartner(partner.partnerType);

          return (
            <section key={partner.id} className="record-section-card">
              <div className="record-section-header">
                <div>
                  <h2 className="record-section-title" style={{ marginBottom: 4 }}>
                    {partner.name}
                  </h2>
                  <div className="text-soft">
                    {partner.code} · {partnerTypeLabel(partner.partnerType)} · {partner.activeUserCount} active user
                    {partner.activeUserCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {boolBadge(partner.isActive)}
                  {boolBadge(getWorkflowAccess(partner).isActive, "Workflow Enabled", "Workflow Disabled")}
                </div>
              </div>

              <div className="record-content" style={{ display: "grid", gap: 16 }}>
                <div className="section-card">
                  <div className="record-section-header">
                    <div>
                      <h3 className="record-section-title">Partner Settings</h3>
                      <div className="text-soft">Update the partner display name, type, and active state.</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => savePartner(partner.id)}
                      disabled={saving === `partner:${partner.id}`}
                    >
                      {saving === `partner:${partner.id}` ? "Saving…" : "Save Partner"}
                    </button>
                  </div>

                  <div className="record-meta-grid">
                    <div className="record-meta-item">
                      <label className="record-meta-label" htmlFor={`partner-name-${partner.id}`}>
                        Partner Name
                      </label>
                      <input
                        id={`partner-name-${partner.id}`}
                        className="input"
                        value={partnerDraft.name}
                        onChange={(event) =>
                          setPartnerDrafts((prev) => ({
                            ...prev,
                            [partner.id]: { ...partnerDraft, name: event.target.value },
                          }))
                        }
                      />
                    </div>

                    <div className="record-meta-item">
                      <label className="record-meta-label" htmlFor={`partner-type-${partner.id}`}>
                        Partner Type
                      </label>
                      <select
                        id={`partner-type-${partner.id}`}
                        className="select"
                        value={partnerDraft.partnerType}
                        onChange={(event) =>
                          setPartnerDrafts((prev) => ({
                            ...prev,
                            [partner.id]: { ...partnerDraft, partnerType: event.target.value },
                          }))
                        }
                      >
                        <option value="WORKFLOW_DESIGN">Workflow Design</option>
                        <option value="WORKFLOW_DIGITIZING">Workflow Digitizing</option>
                        <option value="PRODUCTION">Production</option>
                      </select>
                    </div>

                    <div className="record-meta-item">
                      <div className="record-meta-label">Active</div>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={partnerDraft.isActive}
                          onChange={(event) =>
                            setPartnerDrafts((prev) => ({
                              ...prev,
                              [partner.id]: { ...partnerDraft, isActive: event.target.checked },
                            }))
                          }
                        />
                        Partner is active
                      </label>
                    </div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="record-section-header">
                    <div>
                      <h3 className="record-section-title">Workflow Module Access</h3>
                      <div className="text-soft">
                        Controls whether this partner can use the external Partner Work Workflow area.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => saveAccess(partner.id)}
                      disabled={saving === `access:${partner.id}`}
                    >
                      {saving === `access:${partner.id}` ? "Saving…" : "Save Access"}
                    </button>
                  </div>

                  <div className="external-access-grid">
                    {[
                      ["isActive", "Enabled"],
                      ["canView", "View"],
                      ["canAssignSelf", "Assign"],
                      ["canUpload", "Upload"],
                      ["canDownload", "Download"],
                      ["canNote", "Notes"],
                      ["canComplete", "Complete"],
                    ].map(([key, label]) => (
                      <label key={key} className="external-access-check">
                        <input
                          type="checkbox"
                          checked={Boolean((accessDraft as any)[key])}
                          onChange={(event) =>
                            setAccessDrafts((prev) => ({
                              ...prev,
                              [partner.id]: { ...accessDraft, [key]: event.target.checked },
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="section-card">
                  <div className="record-section-header">
                    <div>
                      <h3 className="record-section-title">Add Existing CAP User</h3>
                      <div className="text-soft">
                        Create the user first in Admin Users, then link the user here to make them external.
                      </div>
                    </div>
                  </div>

                  <div className="external-add-user-grid">
                    <div>
                      <label className="record-meta-label" htmlFor={`link-user-${partner.id}`}>
                        CAP User
                      </label>
                      <select
                        id={`link-user-${partner.id}`}
                        className="select"
                        value={linkDraft.userId}
                        onChange={(event) =>
                          setLinkDrafts((prev) => ({
                            ...prev,
                            [partner.id]: { ...linkDraft, userId: event.target.value },
                          }))
                        }
                      >
                        <option value="">Select user…</option>
                        {dropdownUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {displayUser(user)} ({user.username}){user.externalPartnerId ? ` — currently ${user.externalPartnerName}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="record-meta-label" htmlFor={`link-role-${partner.id}`}>
                        External Role
                      </label>
                      <select
                        id={`link-role-${partner.id}`}
                        className="select"
                        value={linkDraft.externalRole}
                        onChange={(event) =>
                          setLinkDrafts((prev) => ({
                            ...prev,
                            [partner.id]: { ...linkDraft, externalRole: event.target.value },
                          }))
                        }
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => addUser(partner)}
                        disabled={saving === `user:add:${partner.id}`}
                      >
                        {saving === `user:add:${partner.id}` ? "Adding…" : "Link User"}
                      </button>
                      <Link href="/admin/users" className="btn btn-secondary">
                        Create User
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="record-section-header">
                    <div>
                      <h3 className="record-section-title">Linked Partner Users</h3>
                      <div className="text-soft">Users linked here become external users for this partner.</div>
                    </div>
                  </div>

                  {partner.users.length === 0 ? (
                    <div className="text-muted">No users are linked to this partner yet.</div>
                  ) : (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>CAP Role</th>
                            <th>External Role</th>
                            <th>Status</th>
                            <th>Updated</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partner.users.map((userLink) => (
                            <tr key={userLink.id}>
                              <td>
                                <strong>{displayUser(userLink)}</strong>
                                <div className="text-soft">{userLink.username}</div>
                              </td>
                              <td>{userLink.email || "-"}</td>
                              <td>
                                <div>{userLink.capRole || "-"}</div>
                                <div className="text-soft">{userLink.department || "No department"}</div>
                              </td>
                              <td>
                                <select
                                  className="select"
                                  value={userLink.externalRole}
                                  onChange={(event) =>
                                    updatePartnerUser(userLink, { externalRole: event.target.value })
                                  }
                                  disabled={saving === `user:${userLink.id}`}
                                >
                                  {roleOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <div style={{ display: "grid", gap: 4 }}>
                                  {boolBadge(userLink.isActive)}
                                  {!userLink.userIsActive ? (
                                    <span className="badge badge-warning">CAP User Disabled</span>
                                  ) : null}
                                </div>
                              </td>
                              <td>{fmtDateTime(userLink.updatedAt)}</td>
                              <td>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() =>
                                      updatePartnerUser(userLink, { isActive: !userLink.isActive })
                                    }
                                    disabled={saving === `user:${userLink.id}`}
                                  >
                                    {userLink.isActive ? "Disable" : "Enable"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => deactivatePartnerUser(userLink)}
                                    disabled={saving === `user:${userLink.id}` || !userLink.isActive}
                                  >
                                    Deactivate
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <style jsx global>{`
        .external-access-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }

        .external-access-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border: 1px solid var(--border-subtle, #d7d0c3);
          border-radius: 10px;
          background: var(--surface-card, #fff);
          font-weight: 700;
        }

        .external-add-user-grid {
          display: grid;
          grid-template-columns: minmax(240px, 1.5fr) minmax(180px, 1fr) auto;
          gap: 12px;
          align-items: end;
        }

        @media (max-width: 900px) {
          .external-add-user-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
