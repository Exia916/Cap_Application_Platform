"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/components/DataTable";

type Opt = { id: number; name: string };

type Me = {
  username: string | null;
  displayName: string | null;
  employeeNumber: number | null;
  role: string | null;
};

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// ✅ normalize API shapes: [] OR {rows:[]} OR {data:[]}
function normalizeOptions(data: any): Opt[] {
  if (Array.isArray(data)) return data as Opt[];
  if (Array.isArray(data?.rows)) return data.rows as Opt[];
  if (Array.isArray(data?.data)) return data.data as Opt[];
  return [];
}

export default function AddRepairRequestPage() {
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);

  const [departments, setDepartments] = useState<Opt[]>([]);
  const [assets, setAssets] = useState<Opt[]>([]);
  const [priorities, setPriorities] = useState<Opt[]>([]);
  const [issues, setIssues] = useState<Opt[]>([]);

  const [loadingLookups, setLoadingLookups] = useState(true);

  const [departmentId, setDepartmentId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [operatorInitials, setOperatorInitials] = useState("");
  const [commonIssueId, setCommonIssueId] = useState("");
  const [issueDialogue, setIssueDialogue] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load lookups
  useEffect(() => {
    (async () => {
      try {
        setLoadingLookups(true);
        setError(null);

        const [meRes, deptRes, priRes, issRes] = await Promise.all([
          fetchJson("/api/me"),
          fetchJson("/api/cmms/lookups/departments"),
          fetchJson("/api/cmms/lookups/priorities"),
          fetchJson("/api/cmms/lookups/issues"),
        ]);

        setMe(meRes as Me);
        setDepartments(normalizeOptions(deptRes));
        setPriorities(normalizeOptions(priRes));
        setIssues(normalizeOptions(issRes));
      } catch (e: any) {
        setError(e?.message || "Failed to load form data");
      } finally {
        setLoadingLookups(false);
      }
    })();
  }, []);

  // Load assets filtered by department
  useEffect(() => {
    (async () => {
      try {
        if (!departmentId) {
          setAssets([]);
          setAssetId("");
          return;
        }

        const res = await fetchJson(`/api/cmms/lookups/assets?departmentId=${encodeURIComponent(departmentId)}`);
        const list = normalizeOptions(res);
        setAssets(list);

        // If current asset no longer valid, clear it
        if (assetId && !list.some((a) => String(a.id) === String(assetId))) {
          setAssetId("");
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load assets");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const canSubmit = useMemo(() => {
    return !!departmentId && !!assetId && !!priorityId && !!commonIssueId && issueDialogue.trim().length > 0;
  }, [departmentId, assetId, priorityId, commonIssueId, issueDialogue]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Please fill all required fields.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        departmentId: Number(departmentId),
        assetId: Number(assetId),
        priorityId: Number(priorityId),
        operatorInitials: operatorInitials.trim(),
        commonIssueId: Number(commonIssueId),
        issueDialogue: issueDialogue.trim(),
      };

      const res = await fetch("/api/cmms/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any).error || `Create failed (HTTP ${res.status})`);
      }

      router.push("/cmms/repair-requests");
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0 }}>Add Repair Request</h1>

      {error ? <div style={{ color: "crimson", marginTop: 8 }}>{error}</div> : null}

      <form onSubmit={onSubmit} style={{ maxWidth: 720, marginTop: 12 }}>
        <label style={label}>Department *</label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          style={input}
          disabled={saving || loadingLookups}
        >
          <option value="">Select…</option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>

        <label style={label}>Asset *</label>
        <select
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          style={input}
          disabled={saving || loadingLookups || !departmentId}
        >
          <option value="">{departmentId ? "Select…" : "Select department first…"}</option>
          {assets.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.name}
            </option>
          ))}
        </select>

        <label style={label}>Priority *</label>
        <select
          value={priorityId}
          onChange={(e) => setPriorityId(e.target.value)}
          style={input}
          disabled={saving || loadingLookups}
        >
          <option value="">Select…</option>
          {priorities.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>

        <label style={label}>Operator Initials</label>
        <input
          value={operatorInitials}
          onChange={(e) => setOperatorInitials(e.target.value)}
          placeholder="e.g. DT"
          style={input}
          disabled={saving}
        />

        <label style={label}>Common Issue *</label>
        <select
          value={commonIssueId}
          onChange={(e) => setCommonIssueId(e.target.value)}
          style={input}
          disabled={saving || loadingLookups}
        >
          <option value="">Select…</option>
          {issues.map((i) => (
            <option key={i.id} value={String(i.id)}>
              {i.name}
            </option>
          ))}
        </select>

        <label style={label}>Issue Dialogue *</label>
        <textarea
          value={issueDialogue}
          onChange={(e) => setIssueDialogue(e.target.value)}
          placeholder="Describe the problem…"
          style={{ ...input, height: 140 }}
          disabled={saving}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="submit" style={btnSecondary} disabled={saving || !canSubmit}>
            {saving ? "Creating…" : "Create Request"}
          </button>

          <button type="button" style={btnSecondary} onClick={() => router.push("/cmms/repair-requests")} disabled={saving}>
            Cancel
          </button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
          Logged in as: {me?.displayName || me?.username || "Unknown"}
        </div>
      </form>
    </div>
  );
}

const label: React.CSSProperties = {
  display: "block",
  marginTop: 12,
  marginBottom: 6,
  fontWeight: 600,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 8,
  fontSize: 14,
};