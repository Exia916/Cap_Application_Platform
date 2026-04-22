"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import WorkflowSearchModal, {
  type WorkflowSavedSearchRow,
  type WorkflowSearchFilters,
  type WorkflowStatusRow,
  type WorkflowOptionRow,
} from "./WorkflowSearchModal";
import DesignRequestWindow from "./DesignRequestWindow";

type WorkflowRow = {
  id: string;
  requestNumber: string;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  poNumber: string | null;
  tapeName: string | null;
  dateRequestCreated: string;
  dueDate: string | null;
  customerName: string | null;
  customerCode: string | null;
  binCode: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  digitizerUserId: string | null;
  digitizerName: string | null;
  designerUserId: string | null;
  designerName: string | null;
  statusId: number;
  statusCode: string;
  statusLabel: string;
  instructions: string | null;
  additionalInstructions: string | null;
  colorwaysText: string | null;
  tapeNumber: string | null;
  rush: boolean;
  styleCode: string | null;
  sampleSoNumber: string | null;
  stitchCount: number | null;
  artProof: boolean;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

type ListResponse = {
  rows: WorkflowRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

const DEFAULT_FILTERS: WorkflowSearchFilters = {
  salesOrderNumbers: [],
  poNumbers: [],
  tapeNames: [],
  createdByNames: [],
  instructionsTerms: [],
  tapeNumbers: [],
  sampleSoNumbers: [],
  stitchCounts: [],
  customerCodes: [],
  binCodes: [],
  digitizerUserIds: [],
  designerUserIds: [],
  statusIds: [],
  styleCodes: [],
  rush: "",
  artProof: "",
  dateRequestCreatedFrom: "",
  dateRequestCreatedTo: "",
  dueDateFrom: "",
  dueDateTo: "",
};

type SortKey =
  | "requestNumber"
  | "salesOrderNumber"
  | "poNumber"
  | "tapeName"
  | "dateRequestCreated"
  | "dueDate"
  | "customerName"
  | "binCode"
  | "createdByName"
  | "digitizerName"
  | "designerName"
  | "statusId"
  | "tapeNumber"
  | "rush"
  | "styleCode"
  | "sampleSoNumber"
  | "stitchCount"
  | "artProof"
  | "createdAt";

type ModalState =
  | { open: false }
  | { open: true; mode: "new" | "view" | "edit"; requestId?: string };

type ColumnKey =
  | "salesOrderNumber"
  | "poNumber"
  | "tapeName"
  | "dateRequestCreated"
  | "dueDate"
  | "customerName"
  | "binCode"
  | "createdByName"
  | "digitizerName"
  | "designerName"
  | "statusId"
  | "instructions"
  | "tapeNumber"
  | "rush"
  | "styleCode"
  | "sampleSoNumber"
  | "stitchCount"
  | "artProof";

type ListLayoutPrefs = {
  columnOrder: ColumnKey[];
  hiddenColumns: ColumnKey[];
};

type StatusStyle = { key: string; hex: string };

const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  "salesOrderNumber",
  "poNumber",
  "tapeName",
  "dateRequestCreated",
  "dueDate",
  "customerName",
  "binCode",
  "createdByName",
  "digitizerName",
  "designerName",
  "statusId",
  "instructions",
  "tapeNumber",
  "rush",
  "styleCode",
  "sampleSoNumber",
  "stitchCount",
  "artProof",
];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  salesOrderNumber: "Sales Order #",
  poNumber: "PO #",
  tapeName: "Tape Name",
  dateRequestCreated: "Date Request Created",
  dueDate: "Due Date",
  customerName: "Customer",
  binCode: "Bin #",
  createdByName: "Created By",
  digitizerName: "Digitizer",
  designerName: "Designer",
  statusId: "Request Status",
  instructions: "Instructions",
  tapeNumber: "Tape Number",
  rush: "Rush",
  styleCode: "Style",
  sampleSoNumber: "Sample SO Number",
  stitchCount: "Stitch Count",
  artProof: "ART PROOF",
};

const STATUS_STYLES: StatusStyle[] = [
  { key: "unspecified", hex: "#C0C0C0" },
  { key: "a", hex: "#E0E0E0" },
  { key: "b", hex: "#4E7E7E" },
  { key: "c", hex: "#BDB76B" },
  { key: "d", hex: "#F0E68C" },
  { key: "e", hex: "#00FFFF" },
  { key: "f", hex: "#FFC0CB" },
  { key: "g", hex: "#BA55D3" },
  { key: "h", hex: "#00FF00" },
  { key: "i", hex: "#FFDAB9" },
  { key: "l-assigned", hex: "#FFB6C1" },
  { key: "mmc", hex: "#BF00FF" },
  { key: "n", hex: "#708090" },
  { key: "o", hex: "#FF0000" },
  { key: "q", hex: "#FFFF00" },
  { key: "r", hex: "#87CEEB" },
  { key: "s", hex: "#9370DB" },
  { key: "t", hex: "#FFEFD5" },
  { key: "u", hex: "#8B4513" },
  { key: "w", hex: "#FFFDD0" },
  { key: "x", hex: "#778899" },
  { key: "y", hex: "#00008B" },
  { key: "z", hex: "#32CD32" },
  { key: "za", hex: "#98FB98" },
  { key: "ra", hex: "#6495ED" },
  { key: "zb", hex: "#D8BFD8" },
  { key: "zc", hex: "#BDFCC9" },
  { key: "zd", hex: "#F5F5DC" },
  { key: "ze", hex: "#AFEEEE" },
  { key: "zf", hex: "#4682B4" },
  { key: "ca", hex: "#F0E68C" },
  { key: "aa", hex: "#ADFF2F" },
  { key: "ta", hex: "#2F4F4F" },
  { key: "l-ready", hex: "#9370DB" },
  { key: "cb", hex: "#FFCC99" },
  { key: "z-art-fix", hex: "#FF8C00" },
  { key: "db", hex: "#A0522D" },
  { key: "ba", hex: "#008B8B" },
];

function fmtDateOnly(v?: string | null): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDateTime(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function boolText(v: boolean) {
  return v ? "Yes" : "No";
}

function normalizeSearchCriteria(input: any): WorkflowSearchFilters {
  return {
    salesOrderNumbers: Array.isArray(input?.salesOrderNumbers)
      ? input.salesOrderNumbers.map(String)
      : input?.salesOrderNumber
        ? [String(input.salesOrderNumber)]
        : [],
    poNumbers: Array.isArray(input?.poNumbers)
      ? input.poNumbers.map(String)
      : [],
    tapeNames: Array.isArray(input?.tapeNames)
      ? input.tapeNames.map(String)
      : [],
    createdByNames: Array.isArray(input?.createdByNames)
      ? input.createdByNames.map(String)
      : input?.createdByName
        ? [String(input.createdByName)]
        : [],
    instructionsTerms: Array.isArray(input?.instructionsTerms)
      ? input.instructionsTerms.map(String)
      : input?.instructions
        ? [String(input.instructions)]
        : [],
    tapeNumbers: Array.isArray(input?.tapeNumbers)
      ? input.tapeNumbers.map(String)
      : input?.tapeNumber
        ? [String(input.tapeNumber)]
        : [],
    sampleSoNumbers: Array.isArray(input?.sampleSoNumbers)
      ? input.sampleSoNumbers.map(String)
      : input?.sampleSoNumber
        ? [String(input.sampleSoNumber)]
        : [],
    stitchCounts: Array.isArray(input?.stitchCounts)
      ? input.stitchCounts.map(String)
      : input?.stitchCount
        ? [String(input.stitchCount)]
        : [],
    customerCodes: Array.isArray(input?.customerCodes)
      ? input.customerCodes.map(String)
      : input?.customerCode
        ? [String(input.customerCode)]
        : [],
    binCodes: Array.isArray(input?.binCodes)
      ? input.binCodes.map(String)
      : input?.binCode
        ? [String(input.binCode)]
        : [],
    digitizerUserIds: Array.isArray(input?.digitizerUserIds)
      ? input.digitizerUserIds.map(String)
      : input?.digitizerUserId
        ? [String(input.digitizerUserId)]
        : [],
    designerUserIds: Array.isArray(input?.designerUserIds)
      ? input.designerUserIds.map(String)
      : input?.designerUserId
        ? [String(input.designerUserId)]
        : [],
    statusIds: Array.isArray(input?.statusIds)
      ? input.statusIds.map((x: any) => String(x))
      : input?.statusId
        ? [String(input.statusId)]
        : [],
    styleCodes: Array.isArray(input?.styleCodes)
      ? input.styleCodes.map(String)
      : input?.styleCode
        ? [String(input.styleCode)]
        : [],
    rush: String(input?.rush ?? ""),
    artProof: String(input?.artProof ?? ""),
    dateRequestCreatedFrom: String(input?.dateRequestCreatedFrom ?? ""),
    dateRequestCreatedTo: String(input?.dateRequestCreatedTo ?? ""),
    dueDateFrom: String(input?.dueDateFrom ?? ""),
    dueDateTo: String(input?.dueDateTo ?? ""),
  };
}

function mapOptions<T>(
  rows: T[],
  getValue: (row: T) => string,
  getLabel: (row: T) => string,
): WorkflowOptionRow[] {
  return rows.map((row) => ({ value: getValue(row), label: getLabel(row) }));
}

function normalizeLayout(input: any): ListLayoutPrefs {
  const rawOrder = Array.isArray(input?.columnOrder) ? input.columnOrder : [];
  const rawHidden = Array.isArray(input?.hiddenColumns)
    ? input.hiddenColumns
    : [];
  const validOrder = rawOrder.filter((key: unknown): key is ColumnKey =>
    DEFAULT_COLUMN_ORDER.includes(String(key) as ColumnKey),
  );
  const missing = DEFAULT_COLUMN_ORDER.filter(
    (key) => !validOrder.includes(key),
  );
  const validHidden = Array.from(
    new Set(
      rawHidden.filter((key: unknown): key is ColumnKey =>
        DEFAULT_COLUMN_ORDER.includes(String(key) as ColumnKey),
      ),
    ),
  );
  return {
    columnOrder: [...validOrder, ...missing],
    hiddenColumns: validHidden,
  };
}

function singleValue(values?: string[] | null) {
  return Array.isArray(values) && values.length > 0
    ? String(values[0] ?? "")
    : "";
}

function dateRangeFilter(
  fromValue: string,
  toValue: string,
  onFromChange: (next: string) => void,
  onToChange: (next: string) => void,
) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        className="input"
        style={filterInput}
        type="date"
        value={fromValue}
        onChange={(e) => onFromChange(e.target.value)}
        title="From"
      />
      <span style={{ fontSize: 12, opacity: 0.7 }}>–</span>
      <input
        className="input"
        style={filterInput}
        type="date"
        value={toValue}
        onChange={(e) => onToChange(e.target.value)}
        title="To"
      />
    </div>
  );
}

function normalizeStatusToken(v?: string | null): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStatusStyle(
  row: Pick<WorkflowRow, "statusCode" | "statusLabel">,
): StatusStyle {
  const code = normalizeStatusToken(row.statusCode);
  const label = normalizeStatusToken(row.statusLabel);

  const byKey = (key: StatusStyle["key"]) =>
    STATUS_STYLES.find((x) => x.key === key)!;

  const codeIs = (...tokens: string[]) => tokens.includes(code);
  const labelIs = (...tokens: string[]) => tokens.includes(label);
  const labelContains = (...tokens: string[]) =>
    tokens.some((token) => label.includes(token));

  if (codeIs("unspecified") || labelIs("unspecified")) return byKey("unspecified");
  if (codeIs("a") || labelIs("a po to art dept", "po to art dept")) return byKey("a");
  if (codeIs("b") || labelIs("b customer approval of art", "customer approval of art")) return byKey("b");
  if (codeIs("c") || labelIs("c complete so and digitize", "complete so and digitize", "complete so digitize")) return byKey("c");
  if (codeIs("d") || labelIs("d tape complete", "tape complete")) return byKey("d");
  if (codeIs("e") || labelIs("e order to factory", "order to factory")) return byKey("e");
  if (codeIs("f") || labelIs("f run sample", "run sample")) return byKey("f");
  if (codeIs("g") || labelIs("g sample to sewing line", "sample to sewing line")) return byKey("g");
  if (codeIs("h") || labelIs("h sample ran", "sample ran")) return byKey("h");
  if (codeIs("i") || labelIs("i et staging", "iet staging", "et staging")) return byKey("i");
  if (codeIs("l assigned in production") || labelIs("l assigned in production", "assigned in production")) return byKey("l-assigned");
  if (codeIs("mmc") || labelIs("mmc pending art", "pending art")) return byKey("mmc");
  if (codeIs("n") || labelIs("n proofing", "proofing")) return byKey("n");
  if (codeIs("o") || labelIs("o edit", "edit")) return byKey("o");
  if (codeIs("q") || labelIs("q stop ship", "stop ship")) return byKey("q");
  if (codeIs("r") || labelIs("r po to concept art", "po to concept art")) return byKey("r");
  if (codeIs("s") || labelIs("s concept complete", "concept complete")) return byKey("s");
  if (codeIs("t") || labelIs("t customer approval of concept", "customer approval of concept")) return byKey("t");
  if (codeIs("u") || labelIs("u quote", "quote")) return byKey("u");
  if (codeIs("w") || labelIs("w quote complete", "quote complete")) return byKey("w");
  if (codeIs("x") || labelIs("x customer approval of sketch", "customer approval of sketch")) return byKey("x");
  if (codeIs("y") || labelIs("y run sample overseas", "run sample overseas")) return byKey("y");
  if (codeIs("z") || labelIs("z customer approval of overseas sample", "customer approval of overseas sample")) return byKey("z");
  if (codeIs("za") || labelIs("za order to overseas factory", "order to overseas factory")) return byKey("za");
  if (codeIs("ra") || labelIs("ra revisions", "revisions")) return byKey("ra");
  if (codeIs("zb") || labelIs("zb overseas sample in progress", "overseas sample in progress")) return byKey("zb");
  if (codeIs("zc") || labelIs("zc overseas order in production", "overseas order in production")) return byKey("zc");
  if (codeIs("zd") || labelIs("zd overseas customer approval of art", "overseas customer approval of art")) return byKey("zd");
  if (codeIs("ze") || labelIs("ze po to overseas art", "po to overseas art")) return byKey("ze");
  if (codeIs("zf") || labelIs("zf overseas sample pending answers", "overseas sample pending answers")) return byKey("zf");
  if (codeIs("ca") || labelIs("ca overseas tape", "overseas tape")) return byKey("ca");
  if (codeIs("aa") || labelIs("aa ek approved", "ek approved")) return byKey("aa");
  if (codeIs("ta") || labelIs("ta customer approval of quote", "customer approval of quote")) return byKey("ta");
  if (
    codeIs("l ready for digitizing", "l ready for production") ||
    labelIs("l ready for digitizing", "ready for digitizing", "l ready for production", "ready for production")
  ) return byKey("l-ready");
  if (codeIs("cb") || labelIs("cb embroidery for knit", "embroidery for knit")) return byKey("cb");
  if (codeIs("z art fix", "z-art-fix") || labelIs("z art fix") || labelContains("art fix")) return byKey("z-art-fix");
  if (codeIs("db") || labelIs("db leather complete", "leather complete")) return byKey("db");
  if (codeIs("ba") || labelIs("ba pending patch approval from factory", "pending patch approval from factory")) return byKey("ba");

  return byKey("unspecified");
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(value, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function isDarkHex(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.56;
}

function mixHex(hex: string, targetHex: string, weight: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(targetHex);
  const w = Math.max(0, Math.min(1, weight));
  const mix = (x: number, y: number) => Math.round(x * (1 - w) + y * w);
  const r = mix(a.r, b.r);
  const g = mix(a.g, b.g);
  const bVal = mix(a.b, b.b);
  return `#${[r, g, bVal].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function statusBadge(row: Pick<WorkflowRow, "statusCode" | "statusLabel">) {
  const style = getStatusStyle(row);
  const dark = isDarkHex(style.hex);
  const textColor = dark ? "#ffffff" : "#111111";
  const borderColor = dark
    ? mixHex(style.hex, "#ffffff", 0.28)
    : mixHex(style.hex, "#000000", 0.18);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${borderColor}`,
        background: '#ffffff',
        color: '#111111',
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
      title={row.statusLabel}
    >
      {row.statusLabel}
    </span>
  );
}

function rowStatusClass(row: Pick<WorkflowRow, "statusCode" | "statusLabel">) {
  return `workflow-status-${getStatusStyle(row).key}`;
}

function ColumnsDialog({
  open,
  order,
  hidden,
  onClose,
  onApply,
}: {
  open: boolean;
  order: ColumnKey[];
  hidden: ColumnKey[];
  onClose: () => void;
  onApply: (next: ListLayoutPrefs) => void;
}) {
  const [draftOrder, setDraftOrder] = useState<ColumnKey[]>(order);
  const [draftHidden, setDraftHidden] = useState<ColumnKey[]>(hidden);
  const [selectedKey, setSelectedKey] = useState<ColumnKey>(
    order[0] ?? DEFAULT_COLUMN_ORDER[0],
  );

  useEffect(() => {
    if (!open) return;
    setDraftOrder(order);
    setDraftHidden(hidden);
    setSelectedKey(order[0] ?? DEFAULT_COLUMN_ORDER[0]);
  }, [open, order, hidden]);

  if (!open) return null;

  function move(direction: -1 | 1) {
    setDraftOrder((current) => {
      const index = current.indexOf(selectedKey);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  function toggleHidden(key: ColumnKey) {
    setDraftHidden((current) =>
      current.includes(key)
        ? current.filter((x) => x !== key)
        : [...current, key],
    );
  }

  function setHiddenSelected(nextHidden: boolean) {
    setDraftHidden((current) => {
      const exists = current.includes(selectedKey);
      if (nextHidden && !exists) return [...current, selectedKey];
      if (!nextHidden && exists)
        return current.filter((x) => x !== selectedKey);
      return current;
    });
  }

  function resetDefaults() {
    setDraftOrder(DEFAULT_COLUMN_ORDER);
    setDraftHidden([]);
    setSelectedKey(DEFAULT_COLUMN_ORDER[0]);
  }

  return (
    <div style={modalOverlay}>
      <div className="card" style={modalCard}>
        <div style={modalHeader}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              Design Request List Columns
            </div>
            <div className="text-soft" style={{ marginTop: 4, fontSize: 13 }}>
              Check the columns you want visible and use Move Up / Move Down to
              change the order.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={modalBody}>
          <div className="muted-box" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {draftOrder.map((key) => {
                const visible = !draftHidden.includes(key);
                const selected = key === selectedKey;
                return (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      cursor: "pointer",
                      background: selected
                        ? "var(--accent-soft)"
                        : "transparent",
                      borderBottom: "1px solid var(--border)",
                    }}
                    onClick={() => setSelectedKey(key)}
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleHidden(key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span style={{ flex: 1, fontWeight: selected ? 700 : 500 }}>
                      {COLUMN_LABELS[key]}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => move(-1)}
            >
              Move Up
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => move(1)}
            >
              Move Down
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setHiddenSelected(!draftHidden.includes(selectedKey))
              }
            >
              {draftHidden.includes(selectedKey) ? "Show" : "Hide"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetDefaults}
            >
              Reset Defaults
            </button>
          </div>
        </div>

        <div style={modalFooter}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onApply({ columnOrder: draftOrder, hiddenColumns: draftHidden });
              onClose();
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DesignWorkflowPage() {
  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statuses, setStatuses] = useState<WorkflowStatusRow[]>([]);
  const [savedSearches, setSavedSearches] = useState<WorkflowSavedSearchRow[]>(
    [],
  );
  const [customerOptions, setCustomerOptions] = useState<WorkflowOptionRow[]>(
    [],
  );
  const [binOptions, setBinOptions] = useState<WorkflowOptionRow[]>([]);
  const [createdByOptions, setCreatedByOptions] = useState<WorkflowOptionRow[]>(
    [],
  );
  const [digitizerOptions, setDigitizerOptions] = useState<WorkflowOptionRow[]>(
    [],
  );
  const [designerOptions, setDesignerOptions] = useState<WorkflowOptionRow[]>(
    [],
  );
  const [styleOptions, setStyleOptions] = useState<WorkflowOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] =
    useState<WorkflowSearchFilters>(DEFAULT_FILTERS);
  const [selectedSavedSearchId, setSelectedSavedSearchId] =
    useState<string>("");
  const [searchMethod, setSearchMethod] = useState<"match_any" | "match_all">(
    "match_all",
  );
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchOpen, setSearchOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [layout, setLayout] = useState<ListLayoutPrefs>(() =>
    normalizeLayout(null),
  );

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedRequestId) ?? null,
    [rows, selectedRequestId],
  );

  function setSingleArrayFilter(
    key:
      | "salesOrderNumbers"
      | "poNumbers"
      | "tapeNames"
      | "createdByNames"
      | "instructionsTerms"
      | "tapeNumbers"
      | "sampleSoNumbers"
      | "stitchCounts"
      | "customerCodes"
      | "binCodes"
      | "digitizerUserIds"
      | "designerUserIds"
      | "statusIds"
      | "styleCodes",
    value: string,
  ) {
    setFilters((current) => ({ ...current, [key]: value ? [value] : [] }));
    setSelectedSavedSearchId("");
    setSelectedRequestId(null);
  }

  function setScalarFilter(key: "rush" | "artProof", value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedSavedSearchId("");
    setSelectedRequestId(null);
  }

  function setDateFilter(
    key:
      | "dateRequestCreatedFrom"
      | "dateRequestCreatedTo"
      | "dueDateFrom"
      | "dueDateTo",
    value: string,
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedSavedSearchId("");
    setSelectedRequestId(null);
  }

  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      setBootstrapping(true);
      try {
        const [
          statusRes,
          prefRes,
          savedRes,
          customersRes,
          binsRes,
          allUsersRes,
          digitizersRes,
          designersRes,
          stylesRes,
        ] = await Promise.all([
          fetch("/api/design-workflow/statuses", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/preferences", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/saved-searches", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/customers", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/bins", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/users", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/users?department=Digitizing", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/users?department=Art", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/styles", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const statusesData = statusRes.ok ? await statusRes.json() : [];
        const prefData = prefRes.ok ? await prefRes.json() : {};
        const savedData = savedRes.ok ? await savedRes.json() : [];
        const customersData = customersRes.ok ? await customersRes.json() : [];
        const binsData = binsRes.ok ? await binsRes.json() : [];
        const allUsersData = allUsersRes.ok ? await allUsersRes.json() : [];
        const digitizersData = digitizersRes.ok
          ? await digitizersRes.json()
          : [];
        const designersData = designersRes.ok ? await designersRes.json() : [];
        const stylesData = stylesRes.ok ? await stylesRes.json() : [];

        if (!alive) return;

        setStatuses(Array.isArray(statusesData) ? statusesData : []);
        setSavedSearches(Array.isArray(savedData) ? savedData : []);
        setCustomerOptions(
          mapOptions(
            customersData,
            (r: any) => String(r.code),
            (r: any) => String(r.name),
          ),
        );
        setBinOptions(
          mapOptions(
            binsData,
            (r: any) => String(r.code),
            (r: any) => String(r.code),
          ),
        );
        setCreatedByOptions(
          mapOptions(
            allUsersData,
            (r: any) => String(r.name ?? r.displayName ?? r.username),
            (r: any) => String(r.name ?? r.displayName ?? r.username),
          ),
        );
        setDigitizerOptions(
          mapOptions(
            digitizersData,
            (r: any) => String(r.id),
            (r: any) => String(r.name),
          ),
        );
        setDesignerOptions(
          mapOptions(
            designersData,
            (r: any) => String(r.id),
            (r: any) => String(r.name),
          ),
        );
        setStyleOptions(
          mapOptions(
            stylesData,
            (r: any) => String(r.code),
            (r: any) =>
              String(r.description ? `${r.code} - ${r.description}` : r.code),
          ),
        );

        const prefsPayload =
          prefData?.last_search ?? prefData?.lastSearch ?? {};
        setFilters(
          normalizeSearchCriteria(prefsPayload?.filters ?? prefsPayload),
        );
        setSearchMethod(
          prefsPayload?.searchMethod === "match_any"
            ? "match_any"
            : "match_all",
        );
        setLayout(
          normalizeLayout(
            prefsPayload?.listLayout ?? prefData?.listLayout ?? null,
          ),
        );
      } catch {
        if (!alive) return;
      } finally {
        if (alive) setBootstrapping(false);
      }
    }
    bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (bootstrapping) return;
    const t = window.setTimeout(async () => {
      try {
        await fetch("/api/design-workflow/preferences", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            last_search: { searchMethod, filters, listLayout: layout },
          }),
        });
      } catch {}
    }, 500);
    return () => window.clearTimeout(t);
  }, [filters, searchMethod, layout, bootstrapping]);

  useEffect(() => {
    setPageIndex(0);
  }, [filters, searchMethod, sortBy, sortDir, pageSize]);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/design-workflow/search", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: pageIndex + 1,
          pageSize,
          sortField: sortBy,
          sortDir,
          searchMethod,
          filters: {
            ...filters,
            statusIds: filters.statusIds.map((x) => Number(x)),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data?.error || "Failed to load design workflow requests.",
        );
      const payload = data as ListResponse;
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
      setRows(nextRows);
      setTotalCount(
        Number.isFinite(payload?.totalCount) ? payload.totalCount : 0,
      );
      if (
        selectedRequestId &&
        !nextRows.some((r) => r.id === selectedRequestId)
      )
        setSelectedRequestId(null);
    } catch (err: any) {
      setRows([]);
      setTotalCount(0);
      setError(err?.message || "Failed to load design workflow requests.");
      setSelectedRequestId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (bootstrapping) return;
    loadList();
  }, [
    pageIndex,
    pageSize,
    sortBy,
    sortDir,
    filters,
    searchMethod,
    bootstrapping,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  function onToggleSort(key: string) {
    const next = key as SortKey;
    if (sortBy !== next) {
      setSortBy(next);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  const headerFilterValues = useMemo(
    () => ({
      salesOrderNumber: singleValue(filters.salesOrderNumbers),
      poNumber: singleValue(filters.poNumbers),
      tapeName: singleValue(filters.tapeNames),
      instructions: singleValue(filters.instructionsTerms),
      tapeNumber: singleValue(filters.tapeNumbers),
      sampleSoNumber: singleValue(filters.sampleSoNumbers),
      stitchCount: singleValue(filters.stitchCounts),
    }),
    [filters],
  );

  function onFilterChange(key: string, value: string) {
    switch (key) {
      case "salesOrderNumber":
        setSingleArrayFilter("salesOrderNumbers", value);
        return;
      case "poNumber":
        setSingleArrayFilter("poNumbers", value);
        return;
      case "tapeName":
        setSingleArrayFilter("tapeNames", value);
        return;
      case "instructions":
        setSingleArrayFilter("instructionsTerms", value);
        return;
      case "tapeNumber":
        setSingleArrayFilter("tapeNumbers", value);
        return;
      case "sampleSoNumber":
        setSingleArrayFilter("sampleSoNumbers", value);
        return;
      case "stitchCount":
        setSingleArrayFilter("stitchCounts", value);
        return;
      default:
        return;
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setSelectedSavedSearchId("");
    setSearchMethod("match_all");
    setSortBy("createdAt");
    setSortDir("desc");
    setPageIndex(0);
    setSelectedRequestId(null);
  }

  async function voidSelected() {
    if (!selectedRow) return;
    if (!confirm("Void the selected design request?")) return;
    try {
      const res = await fetch(
        `/api/design-workflow/${encodeURIComponent(selectedRow.id)}/void`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Voided from Design Workflow list" }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.error || "Failed to void selected request.");
      setSelectedRequestId(null);
      await loadList();
    } catch (err: any) {
      alert(err?.message || "Failed to void selected request.");
    }
  }

  function openPreview(print = false) {
    if (!selectedRow) return;
    const url = `/design-workflow/${encodeURIComponent(selectedRow.id)}/preview${print ? "?print=1" : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const visibleColumns = useMemo(() => {
    const columnMap: Record<ColumnKey, Column<WorkflowRow>> = {
      salesOrderNumber: {
        key: "salesOrderNumber",
        header: "Sales Order #",
        sortable: true,
        width: 140,
        filterable: true,
        placeholder: "Sales Order #",
        render: (r) => (
          <span style={{ color: "var(--brand-blue)", fontWeight: 700 }}>
            {r.salesOrderDisplay || r.salesOrderNumber || ""}
          </span>
        ),
        getSearchText: (r) => r.salesOrderDisplay || r.salesOrderNumber || "",
      },
      poNumber: {
        key: "poNumber",
        header: "PO #",
        sortable: true,
        width: 120,
        filterable: true,
        placeholder: "PO #",
        render: (r) => r.poNumber || "",
        getSearchText: (r) => r.poNumber || "",
      },
      tapeName: {
        key: "tapeName",
        header: "Tape Name",
        sortable: true,
        width: 180,
        filterable: true,
        placeholder: "Tape Name",
        render: (r) => (
          <span style={{ whiteSpace: "nowrap" }}>{r.tapeName || ""}</span>
        ),
        getSearchText: (r) => r.tapeName || "",
      },
      dateRequestCreated: {
        key: "dateRequestCreated",
        header: "Date Request Created",
        sortable: true,
        width: 180,
        filterRender: dateRangeFilter(
          filters.dateRequestCreatedFrom,
          filters.dateRequestCreatedTo,
          (next) => setDateFilter("dateRequestCreatedFrom", next),
          (next) => setDateFilter("dateRequestCreatedTo", next),
        ),
        render: (r) => fmtDateTime(r.dateRequestCreated),
        getSearchText: (r) => fmtDateTime(r.dateRequestCreated),
      },
      dueDate: {
        key: "dueDate",
        header: "Due Date",
        sortable: true,
        width: 150,
        filterRender: dateRangeFilter(
          filters.dueDateFrom,
          filters.dueDateTo,
          (next) => setDateFilter("dueDateFrom", next),
          (next) => setDateFilter("dueDateTo", next),
        ),
        render: (r) => fmtDateOnly(r.dueDate),
        getSearchText: (r) => fmtDateOnly(r.dueDate),
      },
      customerName: {
        key: "customerName",
        header: "Customer",
        sortable: true,
        width: 180,
        filterRender: (
          <select
            className="select"
            value={singleValue(filters.customerCodes)}
            onChange={(e) =>
              setSingleArrayFilter("customerCodes", e.target.value)
            }
          >
            <option value="">All</option>
            {customerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => r.customerName || "",
        getSearchText: (r) => r.customerName || r.customerCode || "",
      },
      binCode: {
        key: "binCode",
        header: "Bin #",
        sortable: true,
        width: 120,
        filterRender: (
          <select
            className="select"
            value={singleValue(filters.binCodes)}
            onChange={(e) => setSingleArrayFilter("binCodes", e.target.value)}
          >
            <option value="">All</option>
            {binOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => r.binCode || "",
        getSearchText: (r) => r.binCode || "",
      },
      createdByName: {
        key: "createdByName",
        header: "Created By",
        sortable: true,
        width: 140,
        filterRender: (
          <select
            className="select"
            value={singleValue(filters.createdByNames)}
            onChange={(e) =>
              setSingleArrayFilter("createdByNames", e.target.value)
            }
          >
            <option value="">All</option>
            {createdByOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => r.createdByName || "",
        getSearchText: (r) => r.createdByName || "",
      },
      digitizerName: {
        key: "digitizerName",
        header: "Digitizer",
        sortable: true,
        width: 140,
        filterRender: (
          <select
            className="select"
            value={singleValue(filters.digitizerUserIds)}
            onChange={(e) =>
              setSingleArrayFilter("digitizerUserIds", e.target.value)
            }
          >
            <option value="">All</option>
            {digitizerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => r.digitizerName || "",
        getSearchText: (r) => r.digitizerName || "",
      },
      designerName: {
        key: "designerName",
        header: "Designer",
        sortable: true,
        width: 140,
        filterRender: (
          <select
            className="select"
            value={singleValue(filters.designerUserIds)}
            onChange={(e) =>
              setSingleArrayFilter("designerUserIds", e.target.value)
            }
          >
            <option value="">All</option>
            {designerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => r.designerName || "",
        getSearchText: (r) => r.designerName || "",
      },
      statusId: {
        key: "statusId",
        header: "Request Status",
        sortable: true,
        width: 180,
        filterRender: (
          <select
            className="select"
            value={singleValue(filters.statusIds)}
            onChange={(e) => setSingleArrayFilter("statusIds", e.target.value)}
          >
            <option value="">All</option>
            {statuses.map((status) => (
              <option key={status.id} value={String(status.id)}>
                {status.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => statusBadge(r),
        getSearchText: (r) => r.statusLabel,
      },
      instructions: {
        key: "instructions",
        header: "Instructions",
        width: 260,
        filterable: true,
        placeholder: "Instructions",
        render: (r) => (
          <span
            title={r.instructions || ""}
            style={{
              display: "inline-block",
              maxWidth: 240,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {r.instructions || ""}
          </span>
        ),
        getSearchText: (r) => r.instructions || "",
      },
      tapeNumber: {
        key: "tapeNumber",
        header: "Tape Number",
        sortable: true,
        width: 120,
        filterable: true,
        placeholder: "Tape Number",
        render: (r) => r.tapeNumber || "",
        getSearchText: (r) => r.tapeNumber || "",
      },
      rush: {
        key: "rush",
        header: "Rush",
        sortable: true,
        width: 90,
        filterRender: (
          <select
            className="select"
            value={filters.rush}
            onChange={(e) => setScalarFilter("rush", e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        ),
        render: (r) => (
          <span
            className={
              r.rush ? "badge badge-neutral" : "badge badge-neutral"
            }
          >
            {boolText(!!r.rush)}
          </span>
        ),
        getSearchText: (r) => boolText(!!r.rush),
      },
      styleCode: {
        key: "styleCode",
        header: "Style",
        sortable: true,
        width: 130,
        filterRender: (
          <select
            className="select"
            value={singleValue(filters.styleCodes)}
            onChange={(e) => setSingleArrayFilter("styleCodes", e.target.value)}
          >
            <option value="">All</option>
            {styleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => r.styleCode || "",
        getSearchText: (r) => r.styleCode || "",
      },
      sampleSoNumber: {
        key: "sampleSoNumber",
        header: "Sample SO Number",
        sortable: true,
        width: 150,
        filterable: true,
        placeholder: "Sample SO Number",
        render: (r) => r.sampleSoNumber || "",
        getSearchText: (r) => r.sampleSoNumber || "",
      },
      stitchCount: {
        key: "stitchCount",
        header: "Stitch Count",
        sortable: true,
        width: 110,
        filterable: true,
        placeholder: "Stitch Count",
        render: (r) => (r.stitchCount != null ? String(r.stitchCount) : ""),
        getSearchText: (r) =>
          r.stitchCount != null ? String(r.stitchCount) : "",
      },
      artProof: {
        key: "artProof",
        header: "ART PROOF",
        sortable: true,
        width: 110,
        filterRender: (
          <select
            className="select"
            value={filters.artProof}
            onChange={(e) => setScalarFilter("artProof", e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        ),
        render: (r) => (
          <span
            className={
              r.artProof ? "badge badge-brand-blue" : "badge badge-neutral"
            }
          >
            {boolText(!!r.artProof)}
          </span>
        ),
        getSearchText: (r) => boolText(!!r.artProof),
      },
    };

    return layout.columnOrder
      .filter((key) => !layout.hiddenColumns.includes(key))
      .map((key) => columnMap[key]);
  }, [
    layout,
    filters,
    customerOptions,
    binOptions,
    createdByOptions,
    digitizerOptions,
    designerOptions,
    statuses,
    styleOptions,
  ]);

  const columns: Column<WorkflowRow>[] = useMemo(
    () => [
      ...visibleColumns,
      {
        key: "edit",
        header: "Edit",
        sortable: false,
        serverSortable: false,
        width: 80,
        render: (r) => (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRequestId(r.id);
              setModalState({ open: true, mode: "edit", requestId: r.id });
            }}
            disabled={!!r.isVoided}
          >
            Edit
          </button>
        ),
      },
    ],
    [visibleColumns],
  );

  const toolbar = (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setModalState({ open: true, mode: "new" })}
      >
        New
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={voidSelected}
        disabled={!selectedRow || !!selectedRow.isVoided}
      >
        Delete
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => openPreview(true)}
        disabled={!selectedRow}
      >
        Print
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => openPreview(false)}
        disabled={!selectedRow}
      >
        Preview
      </button>
      <button type="button" className="btn btn-secondary" disabled>
        Email
      </button>
      <button
        type="button"
        onClick={() => setColumnsOpen(true)}
        className="btn btn-secondary"
      >
        Columns
      </button>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="btn btn-secondary"
      >
        Search
      </button>
      <button
        type="button"
        onClick={clearFilters}
        className="btn btn-secondary"
        disabled={loading}
      >
        Clear
      </button>

      <div style={{ minWidth: 220 }}>
        <select
          className="select"
          value={selectedSavedSearchId}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedSavedSearchId(id);
            if (!id) return;
            const match = savedSearches.find((s) => String(s.id) === id);
            if (!match) return;
            setFilters(normalizeSearchCriteria(match.search_criteria));
            setSearchMethod(match.search_method ?? "match_all");
            setPageIndex(0);
            setSelectedRequestId(null);
          }}
          disabled={loading}
          title="Saved Search"
        >
          <option value="">Saved Search (None)</option>
          {savedSearches.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.is_shared ? `🌐 ${s.name}` : s.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div className="page-shell-table">
      <style>{`
        .workflow-selected-row > td {
          position: relative;
          box-shadow: inset 0 2px 0 var(--brand-blue), inset 0 -2px 0 var(--brand-blue);
        }
        .workflow-selected-row > td:first-child {
          box-shadow: inset 3px 0 0 var(--brand-blue), inset 0 2px 0 var(--brand-blue), inset 0 -2px 0 var(--brand-blue);
        }
        .workflow-selected-row > td:last-child {
          box-shadow: inset -3px 0 0 var(--brand-blue), inset 0 2px 0 var(--brand-blue), inset 0 -2px 0 var(--brand-blue);
        }
        .workflow-selected-row > td::after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(34, 68, 139, 0.08);
          pointer-events: none;
        }

        .workflow-status-unspecified > td { background: #FFFFFF !important; }
        .workflow-status-a > td { background: #C4C4C4 !important; }
        .workflow-status-b > td { background: #408080 !important; color: #ffffff !important; }
        .workflow-status-c > td { background: #808040 !important; }
        .workflow-status-d > td { background: #FFFF80 !important; }
        .workflow-status-e > td { background: #80FFFF !important; }
        .workflow-status-f > td { background: #FFC0C0 !important; }
        .workflow-status-g > td { background: #8080C0 !important; color: #ffffff !important; }
        .workflow-status-h > td { background: #00D700 !important; }
        .workflow-status-i > td { background: #FF8040 !important; }
        .workflow-status-l-assigned > td { background: #FF9C6A !important; }
        .workflow-status-mmc > td { background: #D200D2 !important; color: #ffffff !important; }
        .workflow-status-n > td { background: #696969 !important; color: #ffffff !important; }
        .workflow-status-o > td { background: #FF0000 !important; color: #ffffff !important; }
        .workflow-status-q > td { background: #FFFF00 !important; }
        .workflow-status-r > td { background: #A7A7A7 !important; }
        .workflow-status-s > td { background: #AF6FF8 !important; color: #ffffff !important; }
        .workflow-status-t > td { background: #408080 !important; }
        .workflow-status-u > td { background: #804000 !important; color: #ffffff !important; }
        .workflow-status-w > td { background: #FFE3CB !important; }
        .workflow-status-x > td { background: #66B4FF !important; color: #ffffff !important; }
        .workflow-status-y > td { background: #005F8D !important; color: #ffffff !important; }
        .workflow-status-z > td { background: #00F900 !important; }
        .workflow-status-za > td { background: #B6B66E !important; }
        .workflow-status-ra > td { background: #6C6CFF !important; color: #ffffff !important; }
        .workflow-status-zb > td { background: #F8D076 !important; }
        .workflow-status-zc > td { background: #FF8000 !important; }
        .workflow-status-zd > td { background: #C8FBEC !important; }
        .workflow-status-ze > td { background: #FFC2BF !important; }
        .workflow-status-zf > td { background: #9DB8E3 !important; color: #ffffff !important; }
        .workflow-status-ca > td { background: #B1B166 !important; }
        .workflow-status-aa > td { background: #CDFF2C !important; }
        .workflow-status-ta > td { background: #408080 !important; color: #ffffff !important; }
        .workflow-status-l-ready > td { background: #AC59FF !important; color: #ffffff !important; }
        .workflow-status-cb > td { background: #FDC066 !important; }
        .workflow-status-z-art-fix > td { background: #FF8000 !important; }
        .workflow-status-db > td { background: #D2700D !important; color: #ffffff !important; }
        .workflow-status-ba > td { background: #00B2C0 !important; color: #ffffff !important; }
      `}</style>

      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Design Workflow</h1>
          <p className="page-subtitle">
            Wilcom-style request queue foundation using the shared CAP list
            pattern.
          </p>
        </div>
      </div>

      <div className="card" style={{ paddingBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 700 }}>Design Request List</div>
          <div className="text-soft">
            {loading
              ? "Loading..."
              : `${totalCount} request${totalCount === 1 ? "" : "s"}`}
          </div>
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <DataTable<WorkflowRow>
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          sortBy={sortBy}
          sortDir={sortDir}
          onToggleSort={onToggleSort}
          filters={headerFilterValues}
          onFilterChange={onFilterChange}
          totalCount={totalCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageSizes={[10, 25, 50, 100]}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          toolbar={toolbar}
          rowKey={(row) => row.id}
          emptyText="No design workflow requests found."
          enableGlobalSearch={false}
          enableCsvExport={true}
          rowClickable={true}
          onRowClick={(row) => setSelectedRequestId(row.id)}
          onRowDoubleClick={(row) => {
            setSelectedRequestId(row.id);
            setModalState({ open: true, mode: "view", requestId: row.id });
          }}
          rowClassName={(row) => {
            const classes = [rowStatusClass(row)];
            if (row.id === selectedRequestId)
              classes.push("workflow-selected-row");
            return classes.join(" ");
          }}
          rowToCsv={(row) => ({
            "Sales Order #":
              row.salesOrderDisplay || row.salesOrderNumber || "",
            "PO #": row.poNumber || "",
            "Tape Name": row.tapeName || "",
            "Date Request Created": fmtDateTime(row.dateRequestCreated),
            "Due Date": fmtDateOnly(row.dueDate),
            Customer: row.customerName || "",
            "Bin #": row.binCode || "",
            "Created By": row.createdByName || "",
            Digitizer: row.digitizerName || "",
            Designer: row.designerName || "",
            "Request Status": row.statusLabel || "",
            Instructions: row.instructions || "",
            "Tape Number": row.tapeNumber || "",
            Rush: boolText(!!row.rush),
            Style: row.styleCode || "",
            "Sample SO Number": row.sampleSoNumber || "",
            "Stitch Count": row.stitchCount ?? "",
            "ART PROOF": boolText(!!row.artProof),
          })}
        />
      </div>

      <ColumnsDialog
        open={columnsOpen}
        order={layout.columnOrder}
        hidden={layout.hiddenColumns}
        onClose={() => setColumnsOpen(false)}
        onApply={(next) => setLayout(normalizeLayout(next))}
      />

      <WorkflowSearchModal
        open={searchOpen}
        filters={filters}
        statuses={statuses}
        savedSearches={savedSearches}
        initialSavedSearchId={selectedSavedSearchId}
        initialSearchMethod={searchMethod}
        customerOptions={customerOptions}
        binOptions={binOptions}
        createdByOptions={createdByOptions}
        digitizerOptions={digitizerOptions}
        designerOptions={designerOptions}
        styleOptions={styleOptions}
        onClose={() => setSearchOpen(false)}
        onSavedSearchesChanged={setSavedSearches}
        onApply={({
          filters: nextFilters,
          savedSearchId,
          searchMethod: nextMethod,
        }) => {
          setFilters(nextFilters);
          setSearchMethod(nextMethod);
          setSelectedSavedSearchId(savedSearchId);
          setPageIndex(0);
          setSelectedRequestId(null);
          setSearchOpen(false);
        }}
      />

      {modalState.open ? (
        <DesignRequestWindow
          mode={modalState.mode}
          requestId={modalState.requestId}
          isModal={true}
          onClose={() => setModalState({ open: false })}
          onSaved={async (saved) => {
            await loadList();
            if (modalState.mode === "view" && "id" in saved && saved.id) {
              setModalState({ open: true, mode: "edit", requestId: saved.id });
              return;
            }
            setModalState({ open: false });
          }}
        />
      ) : null}
    </div>
  );
}

const filterInput: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  fontSize: 12,
  padding: "8px 10px",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,17,17,0.26)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 100,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "90vh",
  overflow: "auto",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 16,
};

const modalBody: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) 140px",
  gap: 16,
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
};
