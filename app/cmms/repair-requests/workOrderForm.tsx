"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { btnSecondary } from "@/components/DataTable";

type Opt = { id: number; name: string };

type WorkOrderDto = {
  workOrderId: number;

  departmentId: number;
  assetId: number;
  priorityId: number;
  commonIssueId: number;

  operatorInitials: string | null;
  issueDialogue: string;

  // tech-only (returned but NOT edited here)
  typeId: number | null;
  techId: number | null;
  statusId: number;
  downtimeRecorded: string | null;
  resolution: string | null;
};

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data as T;
}

function normalizeOptions(data: any): Opt[] {
  if (Array.isArray(data)) return data as Opt[];
  if (Array.isArray(data?.rows)) return data.rows as Opt[];
  if (Array.isArray(data?.data)) return data.data as Opt[];
  return [];
}

function parsePositiveInt(v: unknown): number | null {
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export default function WorkOrderForm({
  mode,
  id,
}: {
  mode: "add" | "edit";
  id?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // ✅ If the prop isn't passed correctly, fall back to parsing the URL.
  const workOrderId = useMemo(() => {
    if (mode !== "edit") return null;

    const fromProp = parsePositiveInt(id);
    if (fromProp) return fromProp;

    // expected: /cmms/repair-requests/123
    const parts = String(pathname || "").split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const fromPath = parsePositiveInt(last);
    return fromPath;
  }, [mode, id, pathname]);

  const [departments, setDepartments] = useState<Opt[]>([]);
  const [assets, setAssets] = useState<Opt[]>([]);
  const [priorities, setPriorities] = useState<Opt[]>([]);
  const [issues, setIssues] = useState<Opt[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form fields (requester-editable)
  const [departmentId, setDepartmentId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [operatorInitials, setOperatorInitials] = useState("");
  const [commonIssueId, setCommonIssueId] = useState("");
  const [issueDialogue, setIssueDialogue] = useState("");

  // load lookups + (if edit) work order
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [deptRes, priRes, issRes] = await Promise.all([
          fetchJson("/api/cmms/lookups/departments"),
          fetchJson("/api/cmms/lookups/priorities"),
          fetchJson("/api/cmms/lookups/issues"),
        ]);

        const dept = normalizeOptions(deptRes);
        const pri = normalizeOptions(priRes);
        const iss = normalizeOptions(issRes);

        setDepartments(dept);
        setPriorities(pri);
        setIssues(iss);

        if (mode === "edit") {
          if (!workOrderId) {
            setError(`Invalid work order id (received: "${String(id ?? "")}", url: "${String(pathname ?? "")}")`);
            return;
          }

          const wo = await fetchJson<WorkOrderDto>(`/api/cmms/work-orders/${workOrderId}`);

          // ✅ set form state from API
          setDepartmentId(String(wo.departmentId ?? ""));
          setPriorityId(String(wo.priorityId ?? ""));
          setCommonIssueId(String(wo.commonIssueId ?? ""));
          setOperatorInitials(wo.operatorInitials ?? "");
          setIssueDialogue(wo.issueDialogue ?? "");

          // assets depend on department, load them before setting assetId
          if (wo.departmentId) {
            const assetRes = await fetchJson(
              `/api/cmms/lookups/assets?departmentId=${encodeURIComponent(String(wo.departmentId))}`
            );
            const assetList = normalizeOptions(assetRes);
            setAssets(assetList);
            setAssetId(String(wo.assetId ?? ""));
          } else {
            setAssets([]);
            setAssetId("");
          }
        } else {
          // add mode - reset any edit leftovers
          setDepartmentId("");
          setAssetId("");
          setAssets([]);
          setPriorityId("");
          setOperatorInitials("");
          setCommonIssueId("");
          setIssueDialogue("");
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load form");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, workOrderId]);

  // when department changes (add mode or manual change), reload assets
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

        // if asset no longer valid, clear it
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

      if (mode === "add") {
        const res = await fetch("/api/cmms/work-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as any).error || `Create failed (HTTP ${res.status})`);
      } else {
        if (!workOrderId) {
          throw new Error(`Invalid work order id (received: "${String(id ?? "")}", url: "${String(pathname ?? "")}")`);
        }

        const res = await fetch(`/api/cmms/work-orders/${workOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as any).error || `Save failed (HTTP ${res.status})`);
      }

      router.push("/cmms/repair-requests");
    } catch (e: any) {
      setError(e?.message || (mode === "add" ? "Create failed" : "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {error ? <div style={{ color: "crimson", marginTop: 8 }}>{error}</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <label style={label}>Department *</label>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={input} disabled={loading || saving}>
          <option value="">Select…</option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>

        <label style={label}>Asset *</label>
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} style={input} disabled={loading || saving || !departmentId}>
          <option value="">{departmentId ? "Select…" : "Select department first…"}</option>
          {assets.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.name}
            </option>
          ))}
        </select>

        <label style={label}>Priority *</label>
        <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)} style={input} disabled={loading || saving}>
          <option value="">Select…</option>
          {priorities.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>

        <label style={label}>Operator Initials</label>
        <input value={operatorInitials} onChange={(e) => setOperatorInitials(e.target.value)} placeholder="e.g. DT" style={input} disabled={saving} />

        <label style={label}>Common Issue *</label>
        <select value={commonIssueId} onChange={(e) => setCommonIssueId(e.target.value)} style={input} disabled={loading || saving}>
          <option value="">Select…</option>
          {issues.map((i) => (
            <option key={i.id} value={String(i.id)}>
              {i.name}
            </option>
          ))}
        </select>

        <label style={label}>Issue Dialogue *</label>
        <textarea value={issueDialogue} onChange={(e) => setIssueDialogue(e.target.value)} placeholder="Describe the problem…" style={{ ...input, height: 140 }} disabled={saving} />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="submit" style={btnSecondary} disabled={saving || loading || !canSubmit}>
            {saving ? (mode === "add" ? "Creating…" : "Saving…") : mode === "add" ? "Create Request" : "Save Changes"}
          </button>

          <button type="button" style={btnSecondary} onClick={() => router.push("/cmms/repair-requests")} disabled={saving}>
            Cancel
          </button>
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