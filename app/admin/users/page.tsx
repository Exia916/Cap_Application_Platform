// app/admin/users/page.tsx
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  display_name: string;
  name: string | null;
  employee_number: number | null;
  role: string;
  is_active: boolean;
  shift: string | null;
  department: string | null;
};

type RoleOption = { code: string; label: string };
type ShiftOption = { code: string; name?: string; label?: string };
type DepartmentOption = { code: string; name?: string; label?: string };

type GenericOption = { value: string; label: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // lookups
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [deptOptions, setDeptOptions] = useState<DepartmentOption[]>([]);

  // search
  const [search, setSearch] = useState("");

  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    display_name: "",
    name: "",
    employee_number: "",
    role: "",
    shift: "",
    department: "",
    is_active: true,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    id: "",
    username: "",
    email: "",
    display_name: "",
    name: "",
    employee_number: "",
    role: "",
    shift: "",
    department: "",
    is_active: true,
    new_password: "",
  });

  async function loadUsers() {
    setError("");
    const res = await fetch("/api/admin/users", { cache: "no-store", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || "Failed to load users");
    setUsers(((json as any).users || []) as UserRow[]);
  }

  function normalizeRolesPayload(payload: any): RoleOption[] {
    // supports:
    // 1) { roles: [{code,label}...] }
    // 2) { options: [{value,label}...] }
    // 3) { rows: [{code,label}...] }
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
    // roles
    const rr = await fetch("/api/lookups/roles", { cache: "no-store", credentials: "include" });
    const rj = await rr.json().catch(() => ({}));
    if (rr.ok) setRoleOptions(normalizeRolesPayload(rj));

    // shifts
    const sr = await fetch("/api/lookups/shifts", { cache: "no-store", credentials: "include" });
    const sj = await sr.json().catch(() => ({}));
    if (sr.ok) setShiftOptions((sj as any).shifts || (sj as any).rows || []);

    // departments
    const dr = await fetch("/api/lookups/departments", { cache: "no-store", credentials: "include" });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // default role after roles load
  useEffect(() => {
    if (!roleOptions.length) return;
    setNewUser((p) => ({ ...p, role: p.role || roleOptions[0]?.code || "USER" }));
    setEditForm((p) => ({ ...p, role: p.role || roleOptions[0]?.code || "USER" }));
  }, [roleOptions]);

  const normalizedSearch = search.trim().toLowerCase();

  const matches = (u: UserRow) => {
    if (!normalizedSearch) return true;

    const haystack = [
      u.username,
      u.email ?? "",
      u.display_name,
      u.name ?? "",
      String(u.employee_number ?? ""),
      String(u.role ?? ""),
      u.shift ?? "",
      u.department ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  };

  const totalActiveCount = useMemo(() => users.filter((u) => u.is_active).length, [users]);

  const activeUsers = useMemo(() => users.filter((u) => u.is_active).filter(matches), [users, normalizedSearch]);

  const inactiveUsers = useMemo(() => users.filter((u) => !u.is_active).filter(matches), [users, normalizedSearch]);

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
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to create user");
      return;
    }

    setNewUser({
      username: "",
      email: "",
      password: "",
      display_name: "",
      name: "",
      employee_number: "",
      role: roleOptions[0]?.code || "USER",
      shift: "",
      department: "",
      is_active: true,
    });

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
      new_password: "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({
      id: "",
      username: "",
      email: "",
      display_name: "",
      name: "",
      employee_number: "",
      role: roleOptions[0]?.code || "USER",
      shift: "",
      department: "",
      is_active: true,
      new_password: "",
    });
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

  if (loading) return <div className="p-6">Loading admin users…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold">Admin – Users</h1>
        <p className="text-sm text-gray-600">Create, edit, reset passwords, and deactivate users.</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Add User */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-base font-semibold mb-3">Add User</h2>
        <form onSubmit={createUser} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <select className="input" name="role" value={newUser.role} onChange={onNewChange}>
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

          <Field label="Shift (code)">
            <select className="input" name="shift" value={newUser.shift} onChange={onNewChange}>
              <option value="">— Select —</option>
              {shiftOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name || s.label || s.code}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Department (code)">
            <select className="input" name="department" value={newUser.department} onChange={onNewChange}>
              <option value="">— Select —</option>
              {deptOptions.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name || d.label || d.code}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="is_active" checked={newUser.is_active} onChange={onNewChange} />
              Active
            </label>

            <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add User</button>
          </div>
        </form>
      </div>

      {/* Active Users */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-base font-semibold mb-3">Active Users</h2>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 w-full">
            <input
              className="input w-full"
              placeholder="Search by name, username, email, employee #, role, shift, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="rounded-full border px-3 py-2 text-sm whitespace-nowrap"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="text-sm text-gray-600 whitespace-nowrap">
            Showing <strong>{activeUsers.length}</strong> active
            {search ? (
              <>
                {" "}
                (filtered from <strong>{totalActiveCount}</strong>)
              </>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Username</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Employee #</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Shift</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Active</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {activeUsers.map((u) => (
                <Fragment key={u.id}>
                  <tr className="border-b">
                    <td className="py-2 pr-3">{u.display_name || u.name || "-"}</td>
                    <td className="py-2 pr-3">{u.username}</td>
                    <td className="py-2 pr-3">{u.email || "-"}</td>
                    <td className="py-2 pr-3">{u.employee_number ?? "-"}</td>
                    <td className="py-2 pr-3">{String(u.role).toUpperCase()}</td>
                    <td className="py-2 pr-3">{u.shift || "-"}</td>
                    <td className="py-2 pr-3">{u.department || "-"}</td>
                    <td className="py-2 pr-3">{u.is_active ? "Yes" : "No"}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-full border px-3 py-1 text-xs" onClick={() => startEditing(u)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-red-600 px-3 py-1 text-xs text-white"
                          onClick={() => deactivateUser(u.id)}
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>

                  {editingId === u.id ? (
                    <tr className="border-b">
                      <td colSpan={9} className="py-3">
                        <div className="rounded-lg border bg-gray-50 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-semibold">
                              Edit User: <span className="font-mono">{u.username}</span>
                            </div>
                            <button type="button" className="rounded-full border px-3 py-1 text-xs" onClick={cancelEditing}>
                              Close
                            </button>
                          </div>

                          <form onSubmit={saveEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                              <select className="input" name="role" value={editForm.role} onChange={onEditChange}>
                                {roleOptions.map((r) => (
                                  <option key={r.code} value={r.code}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Shift (code)">
                              <select className="input" name="shift" value={editForm.shift} onChange={onEditChange}>
                                <option value="">— Select —</option>
                                {shiftOptions.map((s) => (
                                  <option key={s.code} value={s.code}>
                                    {s.name || s.label || s.code}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Department (code)">
                              <select className="input" name="department" value={editForm.department} onChange={onEditChange}>
                                <option value="">— Select —</option>
                                {deptOptions.map((d) => (
                                  <option key={d.code} value={d.code}>
                                    {d.name || d.label || d.code}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="New Password (optional)">
                              <input
                                className="input"
                                type="password"
                                name="new_password"
                                value={editForm.new_password}
                                onChange={onEditChange}
                              />
                            </Field>

                            <div className="flex items-end gap-2">
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" name="is_active" checked={editForm.is_active} onChange={onEditChange} />
                                Active
                              </label>

                              <button className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">Save</button>

                              <button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={cancelEditing}>
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
                  <td className="py-3 text-gray-500" colSpan={9}>
                    No active users.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inactive Users */}
      {inactiveUsers.length ? (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-base font-semibold mb-3">Inactive Users</h2>

          <div className="text-sm text-gray-600 mb-2">
            {search ? (
              <>
                Showing <strong>{inactiveUsers.length}</strong> inactive (filtered)
              </>
            ) : (
              <>
                Showing <strong>{inactiveUsers.length}</strong> inactive
              </>
            )}
          </div>

          <div className="text-sm text-gray-700 space-y-1">
            {inactiveUsers.map((u) => (
              <div key={u.id}>
                <span className="font-mono">{u.username}</span>
                {" — "}
                {u.display_name || u.name || "-"}
                {u.email ? (
                  <>
                    {" — "}
                    <span>{u.email}</span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .input {
          width: 100%;
          height: 36px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 10px;
          font-size: 14px;
          background: white;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
