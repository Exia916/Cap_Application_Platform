"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  WilcomColorway,
  WilcomDesign,
  WilcomStopSequenceRow,
  WilcomThread,
} from "./types";
import DesignPreviewImage from "./DesignPreviewImage";

type TabKey = "general" | "trueview" | "colorways";

type Props = {
  design: WilcomDesign | null;
  open: boolean;
  onClose: () => void;
};

type ColorwayDisplayRow = {
  stop: number | null;
  code: string | null;
  brand: string | null;
  description: string | null;
  rgb: number | null;
  stitches: number | null;
  elementName: string | null;
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function fmtNumber(value?: number | null) {
  if (value === null || value === undefined) return "—";

  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);

  return n.toLocaleString();
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";

  const raw = String(value);
  if (raw.startsWith("1899-12-30")) return "—";

  const d = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleString();
}

function fmtDimensionMm(value?: number | null) {
  if (value === null || value === undefined) return "—";

  const mm = Number(value);
  if (!Number.isFinite(mm)) return String(value);

  const inches = mm / 25.4;
  return `${mm.toFixed(2)} mm (${inches.toFixed(2)} in)`;
}

/**
 * Wilcom thread color values are coming through as BGR / COLORREF-style integers,
 * not normal RGB hex.
 *
 * Example:
 * - Stored integer is interpreted as 0x00BBGGRR
 * - CSS expects rgb(R, G, B)
 */
function bgrToCssColor(value?: number | null) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    return "#ffffff";
  }

  const bgr = n >>> 0;

  const r = bgr & 0xff;
  const g = (bgr >>> 8) & 0xff;
  const b = (bgr >>> 16) & 0xff;

  return `rgb(${r}, ${g}, ${b})`;
}

function bgrToHexLabel(value?: number | null) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    return "#ffffff";
  }

  const bgr = n >>> 0;

  const r = bgr & 0xff;
  const g = (bgr >>> 8) & 0xff;
  const b = (bgr >>> 16) & 0xff;

  return `#${[r, g, b]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={infoItem}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value || "—"}</div>
    </div>
  );
}

function GeneralTab({ design }: { design: WilcomDesign }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={summaryGrid}>
        <div style={previewPanel}>
          <DesignPreviewImage
            src={design.thumbnail || design.trueView}
            alt={`Preview for ${design.name}`}
            mode="thumb"
          />
        </div>

        <div style={infoGrid}>
          <InfoItem label="Design" value={displayValue(design.name)} />
          <InfoItem label="Description" value={displayValue(design.description)} />
          <InfoItem label="Customer" value={displayValue(design.customer)} />
          <InfoItem label="Category" value={displayValue(design.category)} />
          <InfoItem label="Status" value={displayValue(design.status)} />
          <InfoItem label="Digitizer" value={displayValue(design.digitizer)} />
          <InfoItem label="Style" value={displayValue(design.style)} />
          <InfoItem label="Type of Work" value={displayValue(design.typeOfWork)} />
          <InfoItem label="File Type" value={displayValue(design.fileExtension)} />
          <InfoItem label="Version" value={displayValue(design.version)} />
          <InfoItem label="Stitches" value={fmtNumber(design.stitches)} />
          <InfoItem label="Colors" value={fmtNumber(design.colors)} />
          <InfoItem label="Width" value={fmtDimensionMm(design.width)} />
          <InfoItem label="Height" value={fmtDimensionMm(design.height)} />
          <InfoItem label="Stops" value={fmtNumber(design.stops)} />
          <InfoItem label="Trims" value={fmtNumber(design.trims)} />
          <InfoItem label="Appliques" value={fmtNumber(design.appliques)} />
          <InfoItem label="Date Created" value={fmtDateTime(design.dateCreated)} />
          <InfoItem label="Date Modified" value={fmtDateTime(design.dateModified)} />
          <InfoItem label="Due Date" value={fmtDateTime(design.dateDue)} />
        </div>
      </div>

      <div className="section-card" style={{ padding: 14 }}>
        <div style={infoLabel}>General Notes</div>
        <div style={{ marginTop: 8, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
          {design.generalNotes?.trim() || "No general notes."}
        </div>
      </div>

      <div className="section-card" style={{ padding: 14 }}>
        <div style={infoLabel}>File Location</div>
        <div
          style={{
            marginTop: 8,
            color: "var(--text-muted)",
            fontFamily: "monospace",
            fontSize: 12,
            wordBreak: "break-all",
          }}
        >
          {design.fileLocation || "—"}
        </div>
      </div>
    </div>
  );
}

function TrueViewTab({ design }: { design: WilcomDesign }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="muted-box">
        <strong>{design.name}</strong>
        {design.description ? (
          <span style={{ color: "var(--text-soft)" }}> — {design.description}</span>
        ) : null}
      </div>

      <DesignPreviewImage
        src={design.trueView || design.thumbnail}
        alt={`TrueView for ${design.name}`}
        mode="hero"
      />
    </div>
  );
}

function buildColorwayRows(
  colorway: WilcomColorway,
  stopSequence: WilcomStopSequenceRow[]
): ColorwayDisplayRow[] {
  const threads = Array.isArray(colorway.threads) ? colorway.threads : [];

  if (!stopSequence.length) {
    return threads.map((thread) => ({
      stop: thread.index,
      code: thread.code,
      brand: thread.brand,
      description: thread.description,
      rgb: thread.rgb,
      stitches: null,
      elementName: null,
    }));
  }

  const threadByIndex = new Map<number, WilcomThread>();
  for (const thread of threads) {
    threadByIndex.set(Number(thread.index), thread);
  }

  return stopSequence.map((stopRow) => {
    const colorIndex = Number(stopRow.colorIndex);
    const matchingThread = Number.isFinite(colorIndex)
      ? threadByIndex.get(colorIndex)
      : undefined;

    return {
      stop: stopRow.stop ?? null,
      code: matchingThread?.code ?? stopRow.code ?? null,
      brand: matchingThread?.brand ?? stopRow.brand ?? null,
      description: matchingThread?.description ?? stopRow.description ?? null,
      rgb: matchingThread?.rgb ?? stopRow.rgb ?? null,
      stitches: stopRow.stitches ?? null,
      elementName: stopRow.elementName ?? null,
    };
  });
}

function ThreadRow({ row }: { row: ColorwayDisplayRow }) {
  const color = bgrToCssColor(row.rgb);
  const colorLabel = bgrToHexLabel(row.rgb);

  return (
    <tr>
      <td>{displayValue(row.stop)}</td>
      <td>{displayValue(row.code)}</td>
      <td>{displayValue(row.brand)}</td>
      <td>{displayValue(row.description)}</td>
      <td>{fmtNumber(row.stitches)}</td>
      <td>{displayValue(row.elementName)}</td>
      <td>
        <span style={swatchWrap}>
          <span style={{ ...swatch, background: color }} />
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>{colorLabel}</span>
        </span>
      </td>
    </tr>
  );
}

function ColorwayBlock({
  colorway,
  stopSequence,
}: {
  colorway: WilcomColorway;
  stopSequence: WilcomStopSequenceRow[];
}) {
  const rows = buildColorwayRows(colorway, stopSequence);

  return (
    <div className="section-card" style={{ padding: 14 }}>
      <div style={colorwayHeader}>
        <div>
          <h3 style={{ margin: 0 }}>{colorway.colorway || "Colorway"}</h3>
          <div className="text-soft" style={{ marginTop: 4 }}>
            Background fabric: {colorway.backgroundFabric || "—"}
          </div>
        </div>

        <span className="badge badge-neutral">
          {rows.length} {rows.length === 1 ? "Thread" : "Threads"}
        </span>
      </div>

      {rows.length ? (
        <div className="table-scroll">
          <table className="table-clean" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Stop</th>
                <th>Code</th>
                <th>Brand</th>
                <th>Description</th>
                <th>Stitches</th>
                <th>Element Name</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <ThreadRow
                  key={`${colorway.colorwayId}-${row.stop ?? index}-${row.code ?? ""}-${row.rgb ?? ""}-${row.elementName ?? ""}`}
                  row={row}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="muted-box">No thread details available.</div>
      )}
    </div>
  );
}

function ColorwaysTab({ design }: { design: WilcomDesign }) {
  const colorways = Array.isArray(design.colorways) ? design.colorways : [];
  const stopSequence = Array.isArray(design.stopSequence) ? design.stopSequence : [];

  if (!colorways.length) {
    return <div className="muted-box">No colorways available for this design.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {colorways.map((colorway, index) => (
        <ColorwayBlock
          key={`${colorway.colorwayId || "colorway"}-${colorway.colorway || index}`}
          colorway={colorway}
          stopSequence={stopSequence}
        />
      ))}
    </div>
  );
}

export default function DesignLookupModal({ design, open, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>("general");

  useEffect(() => {
    if (open) setTab("general");
  }, [open, design?.id]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const title = useMemo(() => {
    if (!design) return "Design Details";
    return `${design.name}${design.description ? ` — ${design.description}` : ""}`;
  }, [design]);

  if (!open || !design) return null;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div
        className="card"
        style={modal}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Design details"
      >
        <div style={modalHeader}>
          <div>
            <h2 style={{ margin: 0 }}>Design Lookup</h2>
            <div className="page-subtitle" style={{ marginTop: 4 }}>
              {title}
            </div>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={tabBar}>
          <button
            type="button"
            className={
              tab === "general" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"
            }
            onClick={() => setTab("general")}
          >
            General Information
          </button>

          <button
            type="button"
            className={
              tab === "trueview" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"
            }
            onClick={() => setTab("trueview")}
          >
            TrueView
          </button>

          <button
            type="button"
            className={
              tab === "colorways" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"
            }
            onClick={() => setTab("colorways")}
          >
            Colorways
          </button>
        </div>

        <div style={modalBody}>
          {tab === "general" ? <GeneralTab design={design} /> : null}
          {tab === "trueview" ? <TrueViewTab design={design} /> : null}
          {tab === "colorways" ? <ColorwaysTab design={design} /> : null}
        </div>

        <div style={modalFooter}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(17, 17, 17, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
};

const modal: CSSProperties = {
  width: "min(1180px, 96vw)",
  maxHeight: "92vh",
  padding: 0,
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "auto auto minmax(0, 1fr) auto",
};

const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  padding: 16,
  borderBottom: "1px solid var(--border)",
};

const tabBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "10px 16px",
  borderBottom: "1px solid var(--border)",
  background: "var(--surface-subtle)",
};

const modalBody: CSSProperties = {
  padding: 16,
  overflow: "auto",
  minHeight: 0,
};

const modalFooter: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  padding: 16,
  borderTop: "1px solid var(--border)",
  background: "var(--surface-subtle)",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "140px minmax(0, 1fr)",
  gap: 16,
  alignItems: "start",
};

const previewPanel: CSSProperties = {
  display: "grid",
  justifyItems: "center",
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const infoItem: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "var(--surface)",
};

const infoLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "var(--text-soft)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const infoValue: CSSProperties = {
  marginTop: 4,
  color: "var(--text)",
  fontWeight: 650,
  overflowWrap: "anywhere",
};

const colorwayHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};

const swatchWrap: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const swatch: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: "1px solid var(--border-strong)",
  display: "inline-block",
};