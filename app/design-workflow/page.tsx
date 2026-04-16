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

function statusBadge(label: string) {
  return <span className="badge badge-neutral">{label}</span>;
}

function yesNoBadge(v: boolean) {
  return (
    <span className={v ? "badge badge-brand-blue" : "badge badge-neutral"}>
      {v ? "Yes" : "No"}
    </span>
  );
}

function normalizeSearchCriteria(input: any): WorkflowSearchFilters {
  return {
    salesOrderNumbers: Array.isArray(input?.salesOrderNumbers)
      ? input.salesOrderNumbers.map(String)
      : input?.salesOrderNumber
        ? [String(input.salesOrderNumber)]
        : [],
    poNumbers: Array.isArray(input?.poNumbers) ? input.poNumbers.map(String) : [],
    tapeNames: Array.isArray(input?.tapeNames) ? input.tapeNames.map(String) : [],
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
  getLabel: (row: T) => string
): WorkflowOptionRow[] {
  return rows.map((row) => ({
    value: getValue(row),
    label: getLabel(row),
  }));
}

export default function DesignWorkflowPage() {
  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [statuses, setStatuses] = useState<WorkflowStatusRow[]>([]);
  const [savedSearches, setSavedSearches] = useState<WorkflowSavedSearchRow[]>([]);

  const [customerOptions, setCustomerOptions] = useState<WorkflowOptionRow[]>([]);
  const [binOptions, setBinOptions] = useState<WorkflowOptionRow[]>([]);
  const [createdByOptions, setCreatedByOptions] = useState<WorkflowOptionRow[]>([]);
  const [digitizerOptions, setDigitizerOptions] = useState<WorkflowOptionRow[]>([]);
  const [designerOptions, setDesignerOptions] = useState<WorkflowOptionRow[]>([]);
  const [styleOptions, setStyleOptions] = useState<WorkflowOptionRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<WorkflowSearchFilters>(DEFAULT_FILTERS);
  const [selectedSavedSearchId, setSelectedSavedSearchId] = useState<string>("");
  const [searchMethod, setSearchMethod] = useState<"match_any" | "match_all">("match_all");

  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [searchOpen, setSearchOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ open: false });

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedRequestId) ?? null,
    [rows, selectedRequestId]
  );

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
          fetch("/api/design-workflow/statuses", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/preferences", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/saved-searches", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/lookups/customers", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/lookups/bins", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/lookups/users", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/lookups/users?department=Digitizing", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/lookups/users?department=Art", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/lookups/styles", { cache: "no-store", credentials: "include" }),
        ]);

        const statusesData = statusRes.ok ? await statusRes.json() : [];
        const prefData = prefRes.ok ? await prefRes.json() : {};
        const savedData = savedRes.ok ? await savedRes.json() : [];
        const customersData = customersRes.ok ? await customersRes.json() : [];
        const binsData = binsRes.ok ? await binsRes.json() : [];
        const allUsersData = allUsersRes.ok ? await allUsersRes.json() : [];
        const digitizersData = digitizersRes.ok ? await digitizersRes.json() : [];
        const designersData = designersRes.ok ? await designersRes.json() : [];
        const stylesData = stylesRes.ok ? await stylesRes.json() : [];

        if (!alive) return;

        setStatuses(Array.isArray(statusesData) ? statusesData : []);
        setSavedSearches(Array.isArray(savedData) ? savedData : []);

        setCustomerOptions(
          mapOptions(customersData, (r: any) => String(r.code), (r: any) => String(r.name))
        );
        setBinOptions(
          mapOptions(binsData, (r: any) => String(r.code), (r: any) => String(r.code))
        );
        setCreatedByOptions(
          mapOptions(
            allUsersData,
            (r: any) => String(r.name ?? r.displayName ?? r.username),
            (r: any) => String(r.name ?? r.displayName ?? r.username)
          )
        );
        setDigitizerOptions(
          mapOptions(digitizersData, (r: any) => String(r.id), (r: any) => String(r.name))
        );
        setDesignerOptions(
          mapOptions(designersData, (r: any) => String(r.id), (r: any) => String(r.name))
        );
        setStyleOptions(
          mapOptions(
            stylesData,
            (r: any) => String(r.code),
            (r: any) => String(r.description ? `${r.code} - ${r.description}` : r.code)
          )
        );

        const lastSearchRaw = prefData?.last_search ?? prefData?.lastSearch ?? {};
        setFilters(normalizeSearchCriteria(lastSearchRaw.filters ?? lastSearchRaw));
        setSearchMethod(
          lastSearchRaw.searchMethod === "match_any" ? "match_any" : "match_all"
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
            last_search: {
              searchMethod,
              filters,
            },
          }),
        });
      } catch {
        // ignore
      }
    }, 500);

    return () => window.clearTimeout(t);
  }, [filters, searchMethod, bootstrapping]);

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

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load design workflow requests.");
      }

      const payload = data as ListResponse;
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];

      setRows(nextRows);
      setTotalCount(Number.isFinite(payload?.totalCount) ? payload.totalCount : 0);

      if (selectedRequestId && !nextRows.some((r) => r.id === selectedRequestId)) {
        setSelectedRequestId(null);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pageSize, sortBy, sortDir, filters, searchMethod, bootstrapping]);

  function onToggleSort(key: string) {
    const next = key as SortKey;

    if (sortBy !== next) {
      setSortBy(next);
      setSortDir("asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function onFilterChange() {}

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
          body: JSON.stringify({
            reason: "Voided from Design Workflow list",
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to void selected request.");
      }

      setSelectedRequestId(null);
      await loadList();
    } catch (err: any) {
      alert(err?.message || "Failed to void selected request.");
    }
  }

  function openPreview(print = false) {
    if (!selectedRow) return;
    const url = `/design-workflow/${encodeURIComponent(selectedRow.id)}/preview${
      print ? "?print=1" : ""
    }`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const columns: Column<WorkflowRow>[] = useMemo(
    () => [
      {
        key: "salesOrderNumber",
        header: "Sales Order #",
        sortable: true,
        width: 140,
        render: (r) => (
          <span style={{ color: "var(--brand-blue)", fontWeight: 700 }}>
            {r.salesOrderDisplay || r.salesOrderNumber || ""}
          </span>
        ),
        getSearchText: (r) => r.salesOrderDisplay || r.salesOrderNumber || "",
      },
      { key: "poNumber", header: "PO #", sortable: true, width: 120, render: (r) => r.poNumber || "" },
      {
        key: "tapeName",
        header: "Tape Name",
        sortable: true,
        width: 180,
        render: (r) => <span style={{ whiteSpace: "nowrap" }}>{r.tapeName || ""}</span>,
      },
      {
        key: "dateRequestCreated",
        header: "Date Request Created",
        sortable: true,
        width: 170,
        render: (r) => fmtDateTime(r.dateRequestCreated),
        getSearchText: (r) => fmtDateTime(r.dateRequestCreated),
      },
      {
        key: "dueDate",
        header: "Due Date",
        sortable: true,
        width: 120,
        render: (r) => fmtDateOnly(r.dueDate),
      },
      { key: "customerName", header: "Customer", sortable: true, width: 180, render: (r) => r.customerName || "" },
      { key: "binCode", header: "Bin #", sortable: true, width: 120, render: (r) => r.binCode || "" },
      { key: "createdByName", header: "Created By", sortable: true, width: 130, render: (r) => r.createdByName || "" },
      { key: "digitizerName", header: "Digitizer", sortable: true, width: 130, render: (r) => r.digitizerName || "" },
      { key: "designerName", header: "Designer", sortable: true, width: 130, render: (r) => r.designerName || "" },
      {
        key: "statusId",
        header: "Request Status",
        sortable: true,
        width: 180,
        render: (r) => statusBadge(r.statusLabel),
        getSearchText: (r) => r.statusLabel,
      },
      {
        key: "instructions",
        header: "Instructions",
        width: 260,
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
      { key: "tapeNumber", header: "Tape Number", sortable: true, width: 120, render: (r) => r.tapeNumber || "" },
      {
        key: "rush",
        header: "Rush",
        sortable: true,
        width: 80,
        render: (r) => yesNoBadge(!!r.rush),
        getSearchText: (r) => boolText(!!r.rush),
      },
      { key: "styleCode", header: "Style", sortable: true, width: 120, render: (r) => r.styleCode || "" },
      { key: "sampleSoNumber", header: "Sample SO Number", sortable: true, width: 140, render: (r) => r.sampleSoNumber || "" },
      {
        key: "stitchCount",
        header: "Stitch Count",
        sortable: true,
        width: 110,
        render: (r) => (r.stitchCount != null ? String(r.stitchCount) : ""),
      },
      {
        key: "artProof",
        header: "ART PROOF",
        sortable: true,
        width: 100,
        render: (r) => yesNoBadge(!!r.artProof),
        getSearchText: (r) => boolText(!!r.artProof),
      },
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
    []
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
          background: rgba(34, 68, 139, 0.14) !important;
        }
      `}</style>

      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Design Workflow</h1>
          <p className="page-subtitle">
            Wilcom-style request queue foundation using the shared CAP list pattern.
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
            {loading ? "Loading..." : `${totalCount} request${totalCount === 1 ? "" : "s"}`}
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
          filters={{}}
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
          onRowClick={(row) => {
            setSelectedRequestId(row.id);
          }}
          onRowDoubleClick={(row) => {
            setSelectedRequestId(row.id);
            setModalState({ open: true, mode: "view", requestId: row.id });
          }}
          rowClassName={(row) =>
            row.id === selectedRequestId ? "workflow-selected-row" : undefined
          }
          rowToCsv={(row) => ({
            "Sales Order #": row.salesOrderDisplay || row.salesOrderNumber || "",
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
        onApply={({ filters: nextFilters, savedSearchId, searchMethod: nextMethod }) => {
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