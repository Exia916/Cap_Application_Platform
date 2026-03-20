"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

  requestedAt?: string | null;
  requestedByName?: string | null;
  requestedByUserId?: string | null;

  department?: string | null;
  asset?: string | null;
  priority?: string | null;
  commonIssue?: string | null;

  typeId: number | null;
  techId: number | null; // legacy compatibility
  techIds?: number[] | null;
  statusId: number;
  downTimeRecorded: string | null;
  resolution: string | null;

  workOrderType?: string | null;
  tech?: string | null;
  techNames?: string[] | null;
  status?: string | null;
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

function formatWhen(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : String(ts);
}

function nowStamp() {
  return new Date().toLocaleString();
}

function findLabel(options: Opt[], idStr: string) {
  const id = Number(idStr);
  if (!Number.isFinite(id)) return "";
  return options.find((o) => o.id === id)?.name ?? "";
}

function findLabels(options: Opt[], ids: string[]) {
  const set = new Set(ids.map((v) => Number(v)).filter(Number.isFinite));
  return options
    .filter((o) => set.has(o.id))
    .map((o) => o.name);
}

export default function TechWorkOrderForm({ id }: { id: string }) {
  const router = useRouter();
  const workOrderId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [types, setTypes] = useState<Opt[]>([]);
  const [techs, setTechs] = useState<Opt[]>([]);
  const [statuses, setStatuses] = useState<Opt[]>([]);

  const [wo, setWo] = useState<WorkOrderDto | null>(null);

  const [typeId, setTypeId] = useState("");
  const [techIds, setTechIds] = useState<string[]>([]);
  const [statusId, setStatusId] = useState("");
  const [downTimeRecorded, setDownTimeRecorded] = useState("");
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [typeRes, techRes, statusRes, woRes] = await Promise.all([
          fetchJson("/api/cmms/lookups/types"),
          fetchJson("/api/cmms/lookups/techs"),
          fetchJson("/api/cmms/lookups/statuses"),
          fetchJson(`/api/cmms/work-orders/${workOrderId}`),
        ]);

        setTypes(normalizeOptions(typeRes));
        setTechs(normalizeOptions(techRes));
        setStatuses(normalizeOptions(statusRes));

        const dto = woRes as WorkOrderDto;
        setWo(dto);

        setTypeId(dto.typeId == null ? "" : String(dto.typeId));
        setTechIds(
          Array.isArray(dto.techIds) && dto.techIds.length
            ? dto.techIds.map(String)
            : dto.techId != null
              ? [String(dto.techId)]
              : []
        );
        setStatusId(dto.statusId == null ? "" : String(dto.statusId));
        setDownTimeRecorded(dto.downTimeRecorded ?? "");
        setResolution(dto.resolution ?? "");
      } catch (e: any) {
        setError(e?.message || "Failed to load work order");
      } finally {
        setLoading(false);
      }
    })();
  }, [workOrderId]);

  const canSave = useMemo(() => {
    return !loading && !!wo;
  }, [loading, wo]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        typeId: typeId || null,
        techIds: techIds.map((v) => Number(v)).filter(Number.isFinite),
        statusId: statusId || null,
        downTimeRecorded: downTimeRecorded.trim(),
        resolution: resolution.trim(),
      };

      const res = await fetch(`/api/cmms/tech/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error || `Save failed (HTTP ${res.status})`);

      router.push("/cmms");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onPrintPdf() {
    if (!wo) return;

    const typeLabel = typeId ? findLabel(types, typeId) : "";
    const techLabels = findLabels(techs, techIds);
    const statusLabel = statusId ? findLabel(statuses, statusId) : "";

    const title = `Work Order #${wo.workOrderId}`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup blocked. Please allow popups for this site and try again.");
      return;
    }

    w.document.open();
    w.document.write("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>");
    w.document.close();

    w.document.title = title;

    const style = w.document.createElement("style");
    style.textContent = `
      @page { 
        size: portrait;
        margin: 18mm;
      }

      body { 
        font-family: Arial, Helvetica, sans-serif; 
        color: #111827; 
      }

      .logo {
        text-align: center;
        margin-bottom: 14px;
      }

      .logo img {
        max-width: 220px;
        height: auto;
      }

      h1 { 
        font-size: 20px; 
        text-align: center;
        margin: 6px 0 12px 0; 
      }

      .sub { 
        font-size: 11px; 
        color: #374151; 
        margin-bottom: 16px; 
        display: flex; 
        justify-content: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .chip { 
        border: 1px solid #e5e7eb; 
        padding: 4px 8px; 
        border-radius: 999px; 
        background: #f9fafb; 
      }

      .section { 
        margin-top: 18px; 
      }

      .section h2 { 
        font-size: 14px; 
        margin-bottom: 10px; 
        padding-bottom: 6px; 
        border-bottom: 1px solid #e5e7eb; 
      }

      .grid { 
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 12px 20px; 
      }

      .label { 
        font-size: 11px; 
        color: #6b7280; 
        font-weight: 700; 
        margin-bottom: 2px; 
      }

      .value { 
        font-size: 13px; 
      }

      .pre { 
        white-space: pre-wrap; 
      }

      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 6px; 
      }

      th, td { 
        border: 1px solid #e5e7eb; 
        padding: 8px; 
        font-size: 12px; 
        vertical-align: top; 
      }

      th { 
        background: #f3f4f6; 
        text-align: left; 
        width: 180px;
      }
    `;
    w.document.head.appendChild(style);

    const root = w.document.body;

    const logoWrap = w.document.createElement("div");
    logoWrap.className = "logo";

    const logoImg = w.document.createElement("img");
    logoImg.src = "/brand/capamerica85_logo.png";
    logoWrap.appendChild(logoImg);

    root.appendChild(logoWrap);

    const h1 = w.document.createElement("h1");
    h1.textContent = title;
    root.appendChild(h1);

    const sub = w.document.createElement("div");
    sub.className = "sub";
    root.appendChild(sub);

    const chip = (text: string) => {
      const s = w.document.createElement("span");
      s.className = "chip";
      s.textContent = text;
      return s;
    };

    sub.appendChild(chip(`Generated: ${nowStamp()}`));
    sub.appendChild(chip(`Requested At: ${formatWhen(wo.requestedAt) || "—"}`));
    sub.appendChild(chip(`Requested By: ${wo.requestedByName?.trim() || "—"}`));

    const section = (titleText: string) => {
      const wrap = w.document.createElement("div");
      wrap.className = "section";

      const h2 = w.document.createElement("h2");
      h2.textContent = titleText;
      wrap.appendChild(h2);

      root.appendChild(wrap);
      return wrap;
    };

    const addField = (parent: HTMLElement, labelText: string, valueText: string, fullWidth = false, pre = false) => {
      const container = w.document.createElement("div");
      if (fullWidth) container.style.gridColumn = "1 / -1";

      const lab = w.document.createElement("div");
      lab.className = "label";
      lab.textContent = labelText;

      const val = w.document.createElement("div");
      val.className = "value";
      if (pre) val.classList.add("pre");
      val.textContent = valueText || "—";

      container.appendChild(lab);
      container.appendChild(val);
      parent.appendChild(container);
    };

    const s1 = section("Requester Information");
    const gridEl = w.document.createElement("div");
    gridEl.className = "grid";
    s1.appendChild(gridEl);

    addField(gridEl, "Department", wo.department?.trim() || "—");
    addField(gridEl, "Asset", wo.asset?.trim() || "—");
    addField(gridEl, "Priority", wo.priority?.trim() || "—");
    addField(gridEl, "Common Issue", wo.commonIssue?.trim() || "—");
    addField(gridEl, "Operator Name", wo.operatorInitials?.trim() || "—");
    addField(gridEl, "Issue / Notes", wo.issueDialogue?.trim() || "—", true, true);

    const s2 = section("Technician Updates");
    const table = w.document.createElement("table");
    const tbody = w.document.createElement("tbody");
    table.appendChild(tbody);
    s2.appendChild(table);

    const addRow = (k: string, v: string) => {
      const tr = w.document.createElement("tr");
      const th = w.document.createElement("th");
      th.textContent = k;
      const td = w.document.createElement("td");
      td.textContent = v || "—";
      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    };

    addRow("Type", typeLabel || (typeId ? `ID ${typeId}` : "—"));
    addRow("Assigned Tech", techLabels.length ? techLabels.join(", ") : "—");
    addRow("Status", statusLabel || (statusId ? `ID ${statusId}` : "—"));
    addRow("Down Time Recorded", (downTimeRecorded || "").trim() || "—");
    addRow("Resolution", (resolution || "").trim() || "—");

    w.focus();
    setTimeout(() => w.print(), 100);
  }

  return (
    <div style={{ maxWidth: 780 }}>
      {error ? <div style={{ color: "crimson", marginTop: 8 }}>{error}</div> : null}

      {wo ? (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ fontWeight: 800 }}>Requester Info</div>

            <button
              type="button"
              style={btnSecondary}
              onClick={onPrintPdf}
              disabled={loading || saving || !wo}
              title="Opens print dialog (choose Save as PDF)"
            >
              Print / Save PDF
            </button>
          </div>

          <div style={grid}>
            <div>
              <div style={metaLabel}>Requested By</div>
              <div style={metaValue}>{wo.requestedByName?.trim() || "—"}</div>
            </div>

            <div>
              <div style={metaLabel}>Requested At</div>
              <div style={metaValue}>{formatWhen(wo.requestedAt) || "—"}</div>
            </div>

            <div>
              <div style={metaLabel}>Department</div>
              <div style={metaValue}>{wo.department?.trim() || "—"}</div>
            </div>

            <div>
              <div style={metaLabel}>Asset</div>
              <div style={metaValue}>{wo.asset?.trim() || "—"}</div>
            </div>

            <div>
              <div style={metaLabel}>Priority</div>
              <div style={metaValue}>{wo.priority?.trim() || "—"}</div>
            </div>

            <div>
              <div style={metaLabel}>Common Issue</div>
              <div style={metaValue}>{wo.commonIssue?.trim() || "—"}</div>
            </div>

            <div>
              <div style={metaLabel}>Operator Name</div>
              <div style={metaValue}>{wo.operatorInitials?.trim() || "—"}</div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={metaLabel}>Issue / Notes</div>
              <div style={{ ...metaValue, whiteSpace: "pre-wrap" }}>{wo.issueDialogue?.trim() || "—"}</div>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSave} style={{ marginTop: 12 }}>
        <label style={label}>Type</label>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} style={input} disabled={loading || saving}>
          <option value="">Select…</option>
          {types.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.name}
            </option>
          ))}
        </select>

        <label style={label}>Assigned Tech</label>
        <select
          multiple
          value={techIds}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
            setTechIds(values);
          }}
          style={{ ...input, height: 120 }}
          disabled={loading || saving}
        >
          {techs.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.name}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          Hold Ctrl (or Cmd) to select multiple techs
        </div>

        <label style={label}>Status</label>
        <select value={statusId} onChange={(e) => setStatusId(e.target.value)} style={input} disabled={loading || saving}>
          <option value="">Select…</option>
          {statuses.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.name}
            </option>
          ))}
        </select>

        <label style={label}>Down Time Recorded</label>
        <input
          value={downTimeRecorded}
          onChange={(e) => setDownTimeRecorded(e.target.value)}
          placeholder="e.g. 45 minutes, 1:15, etc."
          style={input}
          disabled={saving}
        />

        <label style={label}>Resolution</label>
        <textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Describe what was done…"
          style={{ ...input, height: 140 }}
          disabled={saving}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="submit" style={btnSecondary} disabled={saving || !canSave}>
            {saving ? "Saving…" : "Save Updates"}
          </button>

          <button type="button" style={btnSecondary} onClick={() => router.push("/cmms")} disabled={saving}>
            Cancel
          </button>

          <button
            type="button"
            style={btnSecondary}
            onClick={onPrintPdf}
            disabled={loading || saving || !wo}
            title="Opens print dialog (choose Save as PDF)"
          >
            Print / Save PDF
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

const card: React.CSSProperties = {
  marginTop: 10,
  padding: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fff",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginTop: 10,
};

const metaLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 4,
  fontWeight: 700,
};

const metaValue: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
};