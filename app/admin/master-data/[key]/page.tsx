"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isMasterKey, MASTER_UI, type MasterColumn, type MasterKey } from "../registry";
import MasterDataForm from "@/components/admin/master-data/MasterDataForm";
import MasterDataTable from "@/components/admin/master-data/MasterDataTable";
import MasterDataInactiveList from "@/components/admin/master-data/MasterDataInactiveList";

type Row = Record<string, any>;
type SelectOption = { value: string; label: string };

function normalizeBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return Boolean(v);
}

function getRowId(r: Row): string {
  return String(r.id ?? r.code ?? "");
}

function buildDefaults(columns: MasterColumn[]) {
  const defaults: Record<string, any> = {};

  for (const c of columns) {
    if (c.type === "boolean") defaults[c.key] = true;
    else defaults[c.key] = "";
  }

  if (columns.some((c) => c.key === "sort_order")) defaults.sort_order = 0;
  if (columns.some((c) => c.key === "is_active")) defaults.is_active = true;

  return defaults;
}

function coercePayload(values: Record<string, any>) {
  const out: Record<string, any> = {};

  for (const [key, value] of Object.entries(values || {})) {
    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed === "") {
        out[key] = "";
      } else if (/^-?\d+$/.test(trimmed)) {
        out[key] = Number(trimmed);
      } else {
        out[key] = trimmed;
      }
    } else {
      out[key] = value;
    }
  }

  return out;
}

function validate(values: Record<string, any>, columns: MasterColumn[]) {
  for (const col of columns) {
    if (!col.required) continue;

    const value = values?.[col.key];

    if (col.type === "boolean") {
      if (typeof value !== "boolean") return `${col.label} is required.`;
      continue;
    }

    if (value == null || String(value).trim() === "") {
      return `${col.label} is required.`;
    }
  }

  return "";
}

function toSelectOptions(sourceKey: string, rows: Row[]): SelectOption[] {
  if (sourceKey === "cmms_departments") {
    return rows
      .filter((row) => normalizeBool(row.is_active))
      .map((row) => ({
        value: String(row.id),
        label: String(row.name ?? ""),
      }))
      .filter((opt) => opt.value && opt.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return rows
    .filter((row) => normalizeBool(row.is_active))
    .map((row) => ({
      value: String(row.id ?? row.code ?? ""),
      label: String(row.name ?? row.label ?? row.code ?? row.id ?? ""),
    }))
    .filter((opt) => opt.value && opt.label);
}

export default function AdminMasterDataKeyPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const router = useRouter();

  const [key, setKey] = useState<MasterKey | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [newForm, setNewForm] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [supportsInactive, setSupportsInactive] = useState(false);
  const [allowDelete, setAllowDelete] = useState(false);
  const [selectOptions, setSelectOptions] = useState<Record<string, SelectOption[]>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const p = await params;
      const keyParam = String(p?.key || "");
      const resolved = isMasterKey(keyParam) ? (keyParam as MasterKey) : null;
      if (!cancelled) setKey(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const cfg = key ? MASTER_UI[key] : null;

  useEffect(() => {
    if (!cfg) return;
    setNewForm(buildDefaults(cfg.columns));
  }, [cfg?.key]);

  async function loadRows() {
    if (!key) return;

    const res = await fetch(`/api/admin/master-data/${encodeURIComponent(key)}`, {
      cache: "no-store",
      credentials: "include",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as any)?.error || "Failed to load rows");
    }

    setRows(((json as any).rows || []) as Row[]);
    setSupportsInactive(!!(json as any).supportsInactive);
    setAllowDelete(!!(json as any).allowDelete);
  }

  async function loadSelectOptions(currentCfg: typeof cfg) {
    if (!currentCfg) {
      setSelectOptions({});
      return;
    }

    const selectCols = currentCfg.columns.filter((c) => c.type === "select" && c.optionsSource);
    if (!selectCols.length) {
      setSelectOptions({});
      return;
    }

    const next: Record<string, SelectOption[]> = {};

    for (const col of selectCols) {
      const sourceKey = String(col.optionsSource);

      const res = await fetch(`/api/admin/master-data/${encodeURIComponent(sourceKey)}`, {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (json as any)?.error || `Failed to load options for ${col.label}`
        );
      }

      const sourceRows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
      next[col.key] = toSelectOptions(sourceKey, sourceRows);
    }

    setSelectOptions(next);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!cfg || !key) return;

      setLoading(true);
      setError("");

      try {
        await Promise.all([loadRows(), loadSelectOptions(cfg)]);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load master data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cfg, key]);

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedSearch) return rows;

    return rows.filter((r) => {
      const hay = Object.values(r)
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join(" ")
        .toLowerCase();

      return hay.includes(normalizedSearch);
    });
  }, [rows, normalizedSearch]);

  const activeRows = useMemo(() => {
    if (!supportsInactive) return filtered;
    return filtered.filter((r) => normalizeBool(r.is_active));
  }, [filtered, supportsInactive]);

  const inactiveRows = useMemo(() => {
    if (!supportsInactive) return [];
    return filtered.filter((r) => !normalizeBool(r.is_active));
  }, [filtered, supportsInactive]);

  const onNewChange = (col: MasterColumn, value: any) => {
    setNewForm((p) => ({ ...p, [col.key]: value }));
  };

  const onEditChange = (col: MasterColumn, value: any) => {
    setEditForm((p) => ({ ...p, [col.key]: value }));
  };

  const createRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!key || !cfg) return;

    const msg = validate(newForm, cfg.columns);
    if (msg) {
      setError(msg);
      return;
    }

    const payload = coercePayload(newForm);

    const res = await fetch(`/api/admin/master-data/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to create");
      return;
    }

    setNewForm(buildDefaults(cfg.columns));
    await loadRows();
  };

  const startEditing = (row: Row) => {
    setEditingId(getRowId(row));

    const next: Record<string, any> = {};
    for (const col of cfg?.columns || []) {
      next[col.key] = row[col.key] ?? "";
    }

    setEditForm(next);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!key || !cfg || !editingId) return;

    const msg = validate(editForm, cfg.columns);
    if (msg) {
      setError(msg);
      return;
    }

    const payload = coercePayload(editForm);

    const res = await fetch(
      `/api/admin/master-data/${encodeURIComponent(key)}/${encodeURIComponent(editingId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to update");
      return;
    }

    await loadRows();
    cancelEditing();
  };

  const removeRow = async (id: string) => {
    if (!key) return;

    const message = supportsInactive
      ? "Deactivate this entry? It will no longer appear in dropdowns."
      : "Delete this entry? This action cannot be undone.";

    if (!confirm(message)) return;

    setError("");

    const res = await fetch(
      `/api/admin/master-data/${encodeURIComponent(key)}/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any)?.error || "Failed to remove entry");
      return;
    }

    if (editingId === id) cancelEditing();
    await loadRows();
    if (cfg) {
      await loadSelectOptions(cfg);
    }
  };

  if (!key) return <div className="page-shell">Loading…</div>;

  if (!cfg) {
    return (
      <div className="page-shell">
        <div className="card">
          <h1 className="page-title">Master Data</h1>
          <div className="alert alert-danger">Unknown master data key.</div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/admin/master-data")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page-shell">Loading {cfg.title}…</div>;

  return (
    <div className="page-shell section-stack">
      <div className="card">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Admin – {cfg.title}</h1>
            <p className="page-subtitle">{cfg.description || ""}</p>
            <div className="text-soft">
              Key: <span className="master-card-key">{cfg.key}</span>
            </div>
          </div>

          <Link href="/admin/master-data" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <MasterDataForm
        title={`Add ${cfg.title.endsWith("s") ? cfg.title.slice(0, -1) : cfg.title}`}
        columns={cfg.columns}
        values={newForm}
        optionsByKey={selectOptions}
        submitLabel="Add"
        onChange={onNewChange}
        onSubmit={createRow}
      />

      <div className="card">
        <div className="master-search-bar">
          <div className="master-search-left">
            <input
              className="input"
              placeholder={`Search ${cfg.title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="master-search-meta">
            Showing <strong>{activeRows.length}</strong> active
            {supportsInactive && inactiveRows.length ? (
              <>
                {" "}
                / <strong>{inactiveRows.length}</strong> inactive
              </>
            ) : null}
          </div>
        </div>

        <MasterDataTable
          columns={cfg.columns}
          rows={activeRows}
          editingId={editingId}
          editValues={editForm}
          optionsByKey={selectOptions}
          supportsInactive={supportsInactive}
          allowDelete={allowDelete}
          onStartEdit={startEditing}
          onEditChange={onEditChange}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEditing}
          onRemove={removeRow}
          getRowId={getRowId}
        />
      </div>

      {supportsInactive ? (
        <MasterDataInactiveList
          rows={inactiveRows}
          getRowId={getRowId}
          onEdit={startEditing}
        />
      ) : null}
    </div>
  );
}