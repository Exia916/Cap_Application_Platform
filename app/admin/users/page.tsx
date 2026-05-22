// app/admin/users/page.tsx
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  name: string | null;
  employee_number: number | null;
  role: string;
  is_active: boolean;
  shift: string | null;
  department: string | null;

  emailNotificationsEnabled?: boolean | null;
  inAppNotificationsEnabled?: boolean | null;
  managerUserId?: string | null;
  managerDisplayName?: string | null;
  managerUsername?: string | null;
  lastLoginAt?: string | null;
  updatedBy?: string | null;
  updatedByDisplayName?: string | null;

  securityQuestionsCount?: number | null;
  securityQuestionsEnrolledAt?: string | null;
  securityQuestionsRequired?: boolean | null;
  offsiteSecurityBypassUntil?: string | null;
};

type RoleOption = { code: string; label: string };
type ShiftOption = { code: string; name?: string; label?: string };
type DepartmentOption = { code: string; name?: string; label?: string };

type GenericOption = { value: string; label: string };

type NewUserForm = {
  username: string;
  email: string;
  password: string;
  display_name: string;
  name: string;
  employee_number: string;
  role: string;
  shift: string;
  department: string;
  is_active: boolean;
  email_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
  manager_user_id: string;
};

type EditUserForm = Omit<NewUserForm, "password"> & {
  id: string;
  new_password: string;
};

function emptyNewUser(role = "USER"): NewUserForm {
  return {
    username: "",
    email: "",
    password: "",
    display_name: "",
    name: "",
    employee_number: "",
    role,
    shift: "",
    department: "",
    is_active: true,
    email_notifications_enabled: true,
    in_app_notifications_enabled: true,
    manager_user_id: "",
  };
}

function emptyEditForm(role = "USER"): EditUserForm {
  return {
    id: "",
    username: "",
    email: "",
    display_name: "",
    name: "",
    employee_number: "",
    role,
    shift: "",
    department: "",
    is_active: true,
    email_notifications_enabled: true,
    in_app_notifications_enabled: true,
    manager_user_id: "",
    new_password: "",
  };
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function boolBadge(v: boolean | null | undefined) {
  const enabled = v !== false;
  return (
    <span className={enabled ? "badge badge-success" : "badge badge-neutral"}>
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

function displayUserName(u: UserRow) {
  return u.display_name || u.name || u.username || "-";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [deptOptions, setDeptOptions] = useState<DepartmentOption[]>([]);

  const [search, setSearch] = useState("");

  const [newUser, setNewUser] = useState<NewUserForm>(() => emptyNewUser());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>(() => emptyEditForm());

  async function loadUsers() {
    setError("");
    const res = await fetch("/api/admin/users", {
      cache: "no-store",
      credentials: "include",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || "Failed to load users");

    setUsers(((json as any).users || []) as UserRow[]);
  }

  function normalizeRolesPayload(payload: any): RoleOption[] {
    const roles = (payload?.roles || payload?.rows || []) as any[];
    const options = (payload?.options || []) as GenericOption[];

    if (options.length) {
      return options
        .map((o) => ({
          code: String(o.value || "").toUpperCase(),
          label: String(o.label || o.value || "").trim() || String(o.value || "").toUpperCase(),
        }))
        .filter((r) => r.code);
    }

    return roles
      .map((r) => ({
        code: String(r.code || r.value || "").toUpperCase(),
        label: String(r.label || r.name || r.code || r.value || "").trim() || String(r.code || r.value || "").toUpperCase(),
      }))
      .filter((r) => r.code);
  }

  async function loadLookups() {
    const rr = await fetch("/api/lookups/roles", {
      cache: "no-store",
      credentials: "include",
    });
    const rj = await rr.json().catch(() => ({}));
    if (rr.ok) setRoleOptions(normalizeRolesPayload(rj));

    const sr = await fetch("/api/lookups/shifts", {
      cache: "no-store",
      credentials: "include",
    });
    const sj = await sr.json().catch(() => ({}));
    if (sr.ok) setShiftOptions((sj as any).shifts || (sj as any).rows || []);

    const dr = await fetch("/api/lookups/departments", {
      cache: "no-store",
      credentials: "include",
    });
    const dj = await dr.json().catch(() => ({}));
    if (dr.ok) setDeptOptions((dj as any).departments || (dj as any).rows || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadUsers(), loadLookups()]);
      } catch (e: any) {
        setError(e?.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!roleOptions.length) return;
    setNewUser((p) => ({ ...p, role: p.role || roleOptions[0]?.code || "USER" }));
    setEditForm((p) => ({ ...p, role: p.role || roleOptions[0]?.code || "USER" }));
  }, [roleOptions]);

  const normalizedSearch = search.trim().toLowerCase();

  const managerOptions = useMemo(
    () =>
      users
        .filter((u) => u.is_active)
        .map((u) => ({
          id: u.id,
          label: displayUserName(u),
        })),
    [users]
  );

  function securityQuestionStatus(u: UserRow) {
    const count = Number(u.securityQuestionsCount ?? 0);

    if (count >= 3) {
      return <span className="badge badge-success">Set Up</span>;
    }

    if (count > 0) {
      return <span className="badge badge-warning">{count} of 3</span>;
    }

    return <span className="badge badge-danger">Not Set Up</span>;
  }

  async function resetSecurityQuestions(user: UserRow) {
    const label = displayUserName(user);

    if (
      !confirm(
        `Reset security questions for ${label}? They will need to set up all 3 questions again.`
      )
    ) {
      return;
    }

    setError("");

    const res = await fetch(
      `/api/admin/users/${encodeURIComponent(user.id)}/security-questions/reset`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError((json as any)?.error || "Failed to reset security questions.");
      return;
    }

    await loadUsers();
  }

  const matches = (u: UserRow) => {
    if (!normalizedSearch) return true;

    const haystack = [
      u.username,
      u.email ?? "",
      u.display_name ?? "",
      u.name ?? "",
      String(u.employee_number ?? ""),
      String(u.role ?? ""),
      u.shift ?? "",
      u.department ?? "",
      u.managerDisplayName ?? "",
      u.managerUsername ?? "",
      u.emailNotificationsEnabled === false ? "email notifications disabled" : "email notifications enabled",
      u.inAppNotificationsEnabled === false ? "in app notifications disabled" : "in app notifications enabled",
      u.lastLoginAt ?? "",
      String(u.securityQuestionsCount ?? ""),
      u.securityQuestionsEnrolledAt ?? "",
      u.securityQuestionsRequired ? "security required" : "",
      u.offsiteSecurityBypassUntil ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  };

  const totalActiveCount = useMemo(
    () => users.filter((u) => u.is_active).length,
    [users]
  );

  const activeUsers = useMemo(
    () => users.filter((u) => u.is_active).filter(matches),
    [users, normalizedSearch]
  );

  const inactiveUsers = useMemo(
    () => users.filter((u) => !u.is_active).filter(matches),
    [users, normalizedSearch]
  );

  const onNewChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    setNewUser((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const onEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    setEditForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newUser.username || !newUser.password || !newUser.role) {
      setError("Username, password, and role are required.");
      return;
    }

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...newUser,
        email: newUser.email.trim() || null,
        role: String(newUser.role || "").toUpperCase(),
        employee_number: newUser.employee_number ? Number(newUser.employee_number) : null,
        shift: newUser.shift || null,
        department: newUser.department || null,
        manager_user_id: newUser.manager_user_id || null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to create user");
      return;
    }

    setNewUser(emptyNewUser(roleOptions[0]?.code || "USER"));
    await loadUsers();
  };

  const startEditing = (u: UserRow) => {
    setEditingId(u.id);
    setSearch(u.username);

    setEditForm({
      id: u.id,
      username: u.username,
      email: u.email || "",
      display_name: u.display_name || "",
      name: u.name || "",
      employee_number: u.employee_number?.toString() || "",
      role: String(u.role || roleOptions[0]?.code || "USER").toUpperCase(),
      shift: u.shift || "",
      department: u.department || "",
      is_active: u.is_active,
      email_notifications_enabled: u.emailNotificationsEnabled !== false,
      in_app_notifications_enabled: u.inAppNotificationsEnabled !== false,
      manager_user_id: u.managerUserId || "",
      new_password: "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(emptyEditForm(roleOptions[0]?.code || "USER"));
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...editForm,
        email: editForm.email.trim() || null,
        role: String(editForm.role || "").toUpperCase(),
        employee_number: editForm.employee_number ? Number(editForm.employee_number) : null,
        shift: editForm.shift || null,
        department: editForm.department || null,
        manager_user_id: editForm.manager_user_id || null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to update user");
      return;
    }

    setEditForm((p) => ({ ...p, new_password: "" }));
    await loadUsers();
  };

  const deactivateUser = async (id: string) => {
    if (!confirm("Deactivate this user? They will no longer be able to log in.")) return;

    setError("");

    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to deactivate user");
      return;
    }

    if (editingId === id) cancelEditing();
    await loadUsers();
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card">
          <div className="text-muted">Loading admin users…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-wide section-stack">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Admin – Users</h1>
          <p className="page-subtitle">
            Create, edit, reset passwords, manage security-question setup, configure notification preferences, and deactivate users.
          </p>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="card">
        <div className="section-card-header">
          <h2 style={{ margin: 0 }}>Add User</h2>
        </div>

        <form onSubmit={createUser} className="form-grid">
          <Field label="Name">
            <input className="input" name="name" value={newUser.name} onChange={onNewChange} />
          </Field>

          <Field label="Display Name">
            <input className="input" name="display_name" value={newUser.display_name} onChange={onNewChange} />
          </Field>

          <Field label="Username *">
            <input className="input" name="username" value={newUser.username} onChange={onNewChange} />
          </Field>

          <Field label="Email">
            <input
              className="input"
              type="email"
              name="email"
              value={newUser.email}
              onChange={onNewChange}
              placeholder="name@capamerica.com"
            />
          </Field>

          <Field label="Employee #">
            <input className="input" name="employee_number" value={newUser.employee_number} onChange={onNewChange} />
          </Field>

          <Field label="Role *">
            <select className="select" name="role" value={newUser.role} onChange={onNewChange}>
              {roleOptions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Password *">
            <input className="input" type="password" name="password" value={newUser.password} onChange={onNewChange} />
          </Field>

          <Field label="Shift">
            <select className="select" name="shift" value={newUser.shift} onChange={onNewChange}>
              <option value="">— Select —</option>
              {shiftOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name || s.label || s.code}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Department">
            <select className="select" name="department" value={newUser.department} onChange={onNewChange}>
              <option value="">— Select —</option>
              {deptOptions.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name || d.label || d.code}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Manager">
            <select
              className="select"
              name="manager_user_id"
              value={newUser.manager_user_id}
              onChange={onNewChange}
            >
              <option value="">— None —</option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notification Preferences">
            <div className="muted-box" style={{ display: "grid", gap: 8, minHeight: 42 }}>
              <label className="master-checkbox-row">
                <input
                  type="checkbox"
                  name="email_notifications_enabled"
                  checked={newUser.email_notifications_enabled}
                  onChange={onNewChange}
                />
                Email notifications
              </label>

              <label className="master-checkbox-row">
                <input
                  type="checkbox"
                  name="in_app_notifications_enabled"
                  checked={newUser.in_app_notifications_enabled}
                  onChange={onNewChange}
                />
                In-app notifications
              </label>
            </div>
          </Field>

          <div className="master-form-actions">
            <label className="master-checkbox-row">
              <input type="checkbox" name="is_active" checked={newUser.is_active} onChange={onNewChange} />
              Active
            </label>

            <button className="btn btn-primary" type="submit">
              Add User
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="section-card-header">
          <h2 style={{ margin: 0 }}>Active Users</h2>
        </div>

        <div className="master-search-bar">
          <div className="master-search-left">
            <input
              className="input"
              placeholder="Search by name, username, email, employee #, role, shift, department, manager, notifications, security setup…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="master-search-meta">
            Showing <strong>{activeUsers.length}</strong> active
            {search ? (
              <>
                {" "}
                filtered from <strong>{totalActiveCount}</strong>
              </>
            ) : null}
          </div>
        </div>

        <div className="table-scroll">
          <table className="table-clean table-lines-strong">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Employee #</th>
                <th>Role</th>
                <th>Shift</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Email Notices</th>
                <th>In-App Notices</th>
                <th>Last Login</th>
                <th>Active</th>
                <th>Security Questions</th>
                <th>Enrolled At</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {activeUsers.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td>{displayUserName(u)}</td>
                    <td>{u.username}</td>
                    <td>{u.email || "-"}</td>
                    <td>{u.employee_number ?? "-"}</td>
                    <td>{String(u.role).toUpperCase()}</td>
                    <td>{u.shift || "-"}</td>
                    <td>{u.department || "-"}</td>
                    <td>{u.managerDisplayName || u.managerUsername || "-"}</td>
                    <td>{boolBadge(u.emailNotificationsEnabled)}</td>
                    <td>{boolBadge(u.inAppNotificationsEnabled)}</td>
                    <td>{fmtDateTime(u.lastLoginAt)}</td>
                    <td>{u.is_active ? "Yes" : "No"}</td>
                    <td>{securityQuestionStatus(u)}</td>
                    <td>{fmtDateTime(u.securityQuestionsEnrolledAt)}</td>
                    <td>
                      <div className="master-row-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEditing(u)}>
                          Edit
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => resetSecurityQuestions(u)}
                          disabled={Number(u.securityQuestionsCount ?? 0) <= 0}
                          title={
                            Number(u.securityQuestionsCount ?? 0) > 0
                              ? "Reset security questions"
                              : "No security questions to reset"
                          }
                        >
                          Reset Questions
                        </button>

                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => deactivateUser(u.id)}
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>

                  {editingId === u.id ? (
                    <tr>
                      <td colSpan={15} className="master-edit-cell">
                        <div className="section-card">
                          <div className="master-inline-edit-header">
                            <div className="master-inline-edit-title">
                              Edit User: <span style={{ fontFamily: "monospace" }}>{u.username}</span>
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEditing}>
                              Close
                            </button>
                          </div>

                          <form onSubmit={saveEdit} className="form-grid">
                            <Field label="Username">
                              <input className="input" name="username" value={editForm.username} onChange={onEditChange} />
                            </Field>

                            <Field label="Email">
                              <input
                                className="input"
                                type="email"
                                name="email"
                                value={editForm.email}
                                onChange={onEditChange}
                                placeholder="name@capamerica.com"
                              />
                            </Field>

                            <Field label="Display Name">
                              <input className="input" name="display_name" value={editForm.display_name} onChange={onEditChange} />
                            </Field>

                            <Field label="Name">
                              <input className="input" name="name" value={editForm.name} onChange={onEditChange} />
                            </Field>

                            <Field label="Employee #">
                              <input className="input" name="employee_number" value={editForm.employee_number} onChange={onEditChange} />
                            </Field>

                            <Field label="Role">
                              <select className="select" name="role" value={editForm.role} onChange={onEditChange}>
                                {roleOptions.map((r) => (
                                  <option key={r.code} value={r.code}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Shift">
                              <select className="select" name="shift" value={editForm.shift} onChange={onEditChange}>
                                <option value="">— Select —</option>
                                {shiftOptions.map((s) => (
                                  <option key={s.code} value={s.code}>
                                    {s.name || s.label || s.code}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Department">
                              <select className="select" name="department" value={editForm.department} onChange={onEditChange}>
                                <option value="">— Select —</option>
                                {deptOptions.map((d) => (
                                  <option key={d.code} value={d.code}>
                                    {d.name || d.label || d.code}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Manager">
                              <select
                                className="select"
                                name="manager_user_id"
                                value={editForm.manager_user_id}
                                onChange={onEditChange}
                              >
                                <option value="">— None —</option>
                                {managerOptions
                                  .filter((m) => m.id !== editForm.id)
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.label}
                                    </option>
                                  ))}
                              </select>
                            </Field>

                            <Field label="New Password">
                              <input
                                className="input"
                                type="password"
                                name="new_password"
                                value={editForm.new_password}
                                onChange={onEditChange}
                                placeholder="Optional"
                              />
                            </Field>

                            <Field label="Notification Preferences">
                              <div className="muted-box" style={{ display: "grid", gap: 8, minHeight: 42 }}>
                                <label className="master-checkbox-row">
                                  <input
                                    type="checkbox"
                                    name="email_notifications_enabled"
                                    checked={editForm.email_notifications_enabled}
                                    onChange={onEditChange}
                                  />
                                  Email notifications
                                </label>

                                <label className="master-checkbox-row">
                                  <input
                                    type="checkbox"
                                    name="in_app_notifications_enabled"
                                    checked={editForm.in_app_notifications_enabled}
                                    onChange={onEditChange}
                                  />
                                  In-app notifications
                                </label>
                              </div>
                            </Field>

                            <Field label="Read Only">
                              <div className="muted-box" style={{ minHeight: 42 }}>
                                <div className="text-soft">
                                  <strong>Last Login:</strong> {fmtDateTime(u.lastLoginAt)}
                                </div>
                                <div className="text-soft">
                                  <strong>Updated By:</strong> {u.updatedByDisplayName || "-"}
                                </div>
                              </div>
                            </Field>

                            <div className="master-form-actions">
                              <label className="master-checkbox-row">
                                <input type="checkbox" name="is_active" checked={editForm.is_active} onChange={onEditChange} />
                                Active
                              </label>

                              <button className="btn btn-primary" type="submit">
                                Save
                              </button>

                              <button type="button" className="btn btn-secondary" onClick={cancelEditing}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}

              {activeUsers.length === 0 ? (
                <tr>
                  <td className="text-muted" colSpan={15}>
                    No active users.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {inactiveUsers.length ? (
        <div className="card">
          <div className="section-card-header">
            <h2 style={{ margin: 0 }}>Inactive Users</h2>
          </div>

          <div className="text-muted" style={{ marginBottom: 12 }}>
            {search ? (
              <>
                Showing <strong>{inactiveUsers.length}</strong> inactive filtered
              </>
            ) : (
              <>
                Showing <strong>{inactiveUsers.length}</strong> inactive
              </>
            )}
          </div>

          <div className="section-stack">
            {inactiveUsers.map((u) => (
              <div key={u.id} className="muted-box">
                <span style={{ fontFamily: "monospace" }}>{u.username}</span>
                {" — "}
                {displayUserName(u)}
                {u.email ? (
                  <>
                    {" — "}
                    <span>{u.email}</span>
                  </>
                ) : null}
                {" — "}
                <span>{Number(u.securityQuestionsCount ?? 0) >= 3 ? "Security questions set up" : "Security questions not set up"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}