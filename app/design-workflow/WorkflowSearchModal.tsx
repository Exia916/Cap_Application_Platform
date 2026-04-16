"use client";

import { useEffect, useMemo, useState } from "react";

export type WorkflowSearchFilters = {
  salesOrderNumbers: string[];
  poNumbers: string[];
  tapeNames: string[];
  createdByNames: string[];
  instructionsTerms: string[];
  tapeNumbers: string[];
  sampleSoNumbers: string[];
  stitchCounts: string[];

  customerCodes: string[];
  binCodes: string[];
  digitizerUserIds: string[];
  designerUserIds: string[];
  statusIds: string[];
  styleCodes: string[];

  rush: string;
  artProof: string;

  dateRequestCreatedFrom: string;
  dateRequestCreatedTo: string;
  dueDateFrom: string;
  dueDateTo: string;
};

export type WorkflowSavedSearchRow = {
  id: number;
  name: string;
  search_method: "match_any" | "match_all";
  search_criteria: Record<string, any>;
  is_shared: boolean;
  is_owner?: boolean;
};

export type WorkflowStatusRow = {
  id: number;
  code: string;
  label: string;
  sort_order: number;
};

export type WorkflowOptionRow = {
  value: string;
  label: string;
};

type SearchMethod = "match_any" | "match_all";

function parseCommaList(value: string): string[] {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
    )
  );
}

function joinCommaList(values?: string[]) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((x) => String(x ?? "").trim())
        .filter((x) => x.length > 0)
    )
  ).join(", ");
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

function emptyFilters(): WorkflowSearchFilters {
  return {
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
}

export default function WorkflowSearchModal({
  open,
  filters,
  statuses,
  savedSearches,
  initialSavedSearchId = "",
  initialSearchMethod = "match_all",
  customerOptions,
  binOptions,
  createdByOptions,
  digitizerOptions,
  designerOptions,
  styleOptions,
  onClose,
  onApply,
  onSavedSearchesChanged,
}: {
  open: boolean;
  filters: WorkflowSearchFilters;
  statuses: WorkflowStatusRow[];
  savedSearches: WorkflowSavedSearchRow[];
  initialSavedSearchId?: string;
  initialSearchMethod?: SearchMethod;
  customerOptions: WorkflowOptionRow[];
  binOptions: WorkflowOptionRow[];
  createdByOptions: WorkflowOptionRow[];
  digitizerOptions: WorkflowOptionRow[];
  designerOptions: WorkflowOptionRow[];
  styleOptions: WorkflowOptionRow[];
  onClose: () => void;
  onApply: (next: {
    filters: WorkflowSearchFilters;
    savedSearchId: string;
    searchMethod: SearchMethod;
  }) => void;
  onSavedSearchesChanged: (rows: WorkflowSavedSearchRow[]) => void;
}) {
  const [localFilters, setLocalFilters] = useState<WorkflowSearchFilters>(filters);
  const [savedSearchId, setSavedSearchId] = useState<string>(initialSavedSearchId);
  const [searchMethod, setSearchMethod] = useState<SearchMethod>(initialSearchMethod);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveShared, setSaveShared] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const [salesOrderDraft, setSalesOrderDraft] = useState(joinCommaList(filters.salesOrderNumbers));
  const [poDraft, setPoDraft] = useState(joinCommaList(filters.poNumbers));
  const [tapeNameDraft, setTapeNameDraft] = useState(joinCommaList(filters.tapeNames));
  const [instructionsDraft, setInstructionsDraft] = useState(joinCommaList(filters.instructionsTerms));
  const [tapeNumberDraft, setTapeNumberDraft] = useState(joinCommaList(filters.tapeNumbers));
  const [sampleSoDraft, setSampleSoDraft] = useState(joinCommaList(filters.sampleSoNumbers));
  const [stitchCountDraft, setStitchCountDraft] = useState(joinCommaList(filters.stitchCounts));

  useEffect(() => {
    if (!open) return;

    setLocalFilters(filters);
    setSavedSearchId(initialSavedSearchId);
    setSearchMethod(initialSearchMethod);

    setSalesOrderDraft(joinCommaList(filters.salesOrderNumbers));
    setPoDraft(joinCommaList(filters.poNumbers));
    setTapeNameDraft(joinCommaList(filters.tapeNames));
    setInstructionsDraft(joinCommaList(filters.instructionsTerms));
    setTapeNumberDraft(joinCommaList(filters.tapeNumbers));
    setSampleSoDraft(joinCommaList(filters.sampleSoNumbers));
    setStitchCountDraft(joinCommaList(filters.stitchCounts));
  }, [open, filters, initialSavedSearchId, initialSearchMethod]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selectedSavedSearch = useMemo(
    () => savedSearches.find((s) => String(s.id) === savedSearchId) ?? null,
    [savedSearches, savedSearchId]
  );

  const activeCount = useMemo(() => {
    const entries = Object.entries(localFilters);
    return entries.filter(([_, v]) => {
      if (Array.isArray(v)) return v.length > 0;
      return String(v ?? "").trim() !== "";
    }).length;
  }, [localFilters]);

  function setField<K extends keyof WorkflowSearchFilters>(
    key: K,
    value: WorkflowSearchFilters[K]
  ) {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetAll() {
    const cleared = emptyFilters();
    setLocalFilters(cleared);
    setSavedSearchId("");
    setSearchMethod("match_all");

    setSalesOrderDraft("");
    setPoDraft("");
    setTapeNameDraft("");
    setInstructionsDraft("");
    setTapeNumberDraft("");
    setSampleSoDraft("");
    setStitchCountDraft("");
  }

  function applySavedSearch(id: string) {
    setSavedSearchId(id);

    if (!id) return;

    const match = savedSearches.find((s) => String(s.id) === id);
    if (!match) return;

    const normalized = normalizeSearchCriteria(match.search_criteria);
    setLocalFilters(normalized);
    setSearchMethod(match.search_method ?? "match_all");

    setSalesOrderDraft(joinCommaList(normalized.salesOrderNumbers));
    setPoDraft(joinCommaList(normalized.poNumbers));
    setTapeNameDraft(joinCommaList(normalized.tapeNames));
    setInstructionsDraft(joinCommaList(normalized.instructionsTerms));
    setTapeNumberDraft(joinCommaList(normalized.tapeNumbers));
    setSampleSoDraft(joinCommaList(normalized.sampleSoNumbers));
    setStitchCountDraft(joinCommaList(normalized.stitchCounts));
  }

  async function refreshSavedSearches() {
    const res = await fetch("/api/design-workflow/saved-searches", {
      cache: "no-store",
      credentials: "include",
    });
    const data = res.ok ? await res.json() : [];
    onSavedSearchesChanged(Array.isArray(data) ? data : []);
  }

  async function createSavedSearch() {
    if (!saveName.trim()) return;

    const committedFilters: WorkflowSearchFilters = {
      ...localFilters,
      salesOrderNumbers: parseCommaList(salesOrderDraft),
      poNumbers: parseCommaList(poDraft),
      tapeNames: parseCommaList(tapeNameDraft),
      instructionsTerms: parseCommaList(instructionsDraft),
      tapeNumbers: parseCommaList(tapeNumberDraft),
      sampleSoNumbers: parseCommaList(sampleSoDraft),
      stitchCounts: parseCommaList(stitchCountDraft),
    };

    setSaveBusy(true);
    try {
      const res = await fetch("/api/design-workflow/saved-searches", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          search_method: searchMethod,
          search_criteria: committedFilters,
          is_shared: saveShared,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data || "Failed to save search.");
      }

      setLocalFilters(committedFilters);
      await refreshSavedSearches();
      setSaveOpen(false);
      setSavedSearchId(String(data.id));
    } catch (err: any) {
      alert(err?.message || "Failed to save search.");
    } finally {
      setSaveBusy(false);
    }
  }

  async function updateCurrentSavedSearch() {
    if (!selectedSavedSearch || !selectedSavedSearch.is_owner) return;

    const committedFilters: WorkflowSearchFilters = {
      ...localFilters,
      salesOrderNumbers: parseCommaList(salesOrderDraft),
      poNumbers: parseCommaList(poDraft),
      tapeNames: parseCommaList(tapeNameDraft),
      instructionsTerms: parseCommaList(instructionsDraft),
      tapeNumbers: parseCommaList(tapeNumberDraft),
      sampleSoNumbers: parseCommaList(sampleSoDraft),
      stitchCounts: parseCommaList(stitchCountDraft),
    };

    try {
      const res = await fetch("/api/design-workflow/saved-searches", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSavedSearch.id,
          name: selectedSavedSearch.name,
          search_method: searchMethod,
          search_criteria: committedFilters,
          is_shared: !!selectedSavedSearch.is_shared,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data || "Failed to update saved search.");
      }

      setLocalFilters(committedFilters);
      await refreshSavedSearches();
    } catch (err: any) {
      alert(err?.message || "Failed to update saved search.");
    }
  }

  async function deleteCurrentSavedSearch() {
    if (!selectedSavedSearch || !selectedSavedSearch.is_owner) return;
    if (!confirm(`Delete saved search "${selectedSavedSearch.name}"?`)) return;

    try {
      const res = await fetch(
        `/api/design-workflow/saved-searches?id=${encodeURIComponent(
          String(selectedSavedSearch.id)
        )}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data || "Failed to delete saved search.");
      }

      await refreshSavedSearches();
      setSavedSearchId("");
    } catch (err: any) {
      alert(err?.message || "Failed to delete saved search.");
    }
  }

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={windowStyle}>
        <div style={titleBar}>
          <div style={{ fontWeight: 700 }}>Search Design Requests</div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
            ×
          </button>
        </div>

        <div style={tabsRow}>
          <div style={activeTab}>Fixed Fields</div>
          <div style={inactiveTab}>User Defined</div>
        </div>

        <div style={body}>
          <div style={fieldsWrap}>
            <div style={leftCol}>
              <Field label="Sales Order #">
                <input
                  className="input"
                  value={salesOrderDraft}
                  onChange={(e) => setSalesOrderDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = parseCommaList(salesOrderDraft);
                    setField("salesOrderNumbers", parsed);
                    setSalesOrderDraft(joinCommaList(parsed));
                  }}
                />
              </Field>

              <Field label="PO #">
                <input
                  className="input"
                  value={poDraft}
                  onChange={(e) => setPoDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = parseCommaList(poDraft);
                    setField("poNumbers", parsed);
                    setPoDraft(joinCommaList(parsed));
                  }}
                />
              </Field>

              <Field label="Tape Name">
                <input
                  className="input"
                  value={tapeNameDraft}
                  onChange={(e) => setTapeNameDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = parseCommaList(tapeNameDraft);
                    setField("tapeNames", parsed);
                    setTapeNameDraft(joinCommaList(parsed));
                  }}
                />
              </Field>

              <Field label="Date Request Created">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input
                    className="input"
                    type="date"
                    value={localFilters.dateRequestCreatedFrom}
                    onChange={(e) => setField("dateRequestCreatedFrom", e.target.value)}
                    title="From"
                  />
                  <input
                    className="input"
                    type="date"
                    value={localFilters.dateRequestCreatedTo}
                    onChange={(e) => setField("dateRequestCreatedTo", e.target.value)}
                    title="To"
                  />
                </div>
              </Field>

              <Field label="Due Date">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input
                    className="input"
                    type="date"
                    value={localFilters.dueDateFrom}
                    onChange={(e) => setField("dueDateFrom", e.target.value)}
                    title="From"
                  />
                  <input
                    className="input"
                    type="date"
                    value={localFilters.dueDateTo}
                    onChange={(e) => setField("dueDateTo", e.target.value)}
                    title="To"
                  />
                </div>
              </Field>

              <Field label="Customer">
                <MultiSelectPicker
                  options={customerOptions}
                  selected={localFilters.customerCodes}
                  onChange={(next) => setField("customerCodes", next)}
                />
              </Field>

              <Field label="Bin #">
                <MultiSelectPicker
                  options={binOptions}
                  selected={localFilters.binCodes}
                  onChange={(next) => setField("binCodes", next)}
                />
              </Field>

              <Field label="Created By">
                <MultiSelectPicker
                  options={createdByOptions}
                  selected={localFilters.createdByNames}
                  onChange={(next) => setField("createdByNames", next)}
                  openUp={true}
                />
              </Field>

              <Field label="Digitizer">
                <MultiSelectPicker
                  options={digitizerOptions}
                  selected={localFilters.digitizerUserIds}
                  onChange={(next) => setField("digitizerUserIds", next)}
                  openUp={true}
                />
              </Field>

              <Field label="Designer">
                <MultiSelectPicker
                  options={designerOptions}
                  selected={localFilters.designerUserIds}
                  onChange={(next) => setField("designerUserIds", next)}
                  openUp={true}
                />
              </Field>

              <Field label="Request Status">
                <MultiSelectPicker
                  options={statuses.map((s) => ({
                    value: String(s.id),
                    label: s.label,
                  }))}
                  selected={localFilters.statusIds}
                  onChange={(next) => setField("statusIds", next)}
                  openUp={true}
                />
              </Field>
            </div>

            <div style={rightCol}>
              <Field label="Instructions">
                <textarea
                  className="textarea"
                  rows={6}
                  value={instructionsDraft}
                  onChange={(e) => setInstructionsDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = parseCommaList(instructionsDraft);
                    setField("instructionsTerms", parsed);
                    setInstructionsDraft(joinCommaList(parsed));
                  }}
                />
              </Field>

              <Field label="Tape Number">
                <input
                  className="input"
                  value={tapeNumberDraft}
                  onChange={(e) => setTapeNumberDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = parseCommaList(tapeNumberDraft);
                    setField("tapeNumbers", parsed);
                    setTapeNumberDraft(joinCommaList(parsed));
                  }}
                />
              </Field>

              <Field label="Style">
                <MultiSelectPicker
                  options={styleOptions}
                  selected={localFilters.styleCodes}
                  onChange={(next) => setField("styleCodes", next)}
                  openUp={true}
                />
              </Field>

              <Field label="Sample SO Number">
                <input
                  className="input"
                  value={sampleSoDraft}
                  onChange={(e) => setSampleSoDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = parseCommaList(sampleSoDraft);
                    setField("sampleSoNumbers", parsed);
                    setSampleSoDraft(joinCommaList(parsed));
                  }}
                />
              </Field>

              <Field label="Stitch Count">
                <input
                  className="input"
                  value={stitchCountDraft}
                  onChange={(e) => setStitchCountDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = parseCommaList(stitchCountDraft);
                    setField("stitchCounts", parsed);
                    setStitchCountDraft(joinCommaList(parsed));
                  }}
                />
              </Field>

              <Field label="Rush">
                <select
                  className="select"
                  value={localFilters.rush}
                  onChange={(e) => setField("rush", e.target.value)}
                >
                  <option value="">(Any)</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>

              <Field label="ART PROOF">
                <select
                  className="select"
                  value={localFilters.artProof}
                  onChange={(e) => setField("artProof", e.target.value)}
                >
                  <option value="">(Any)</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>

              <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-soft)" }}>
                Active Criteria: <strong>{activeCount}</strong>
              </div>
            </div>
          </div>

          <div style={bottomRow}>
            <div style={searchMethodBox}>
              <div style={boxTitle}>Search Method</div>

              <label style={radioRow}>
                <input
                  type="radio"
                  checked={searchMethod === "match_any"}
                  onChange={() => setSearchMethod("match_any")}
                />
                <span>Designs which match any of these criteria</span>
              </label>

              <label style={radioRow}>
                <input
                  type="radio"
                  checked={searchMethod === "match_all"}
                  onChange={() => setSearchMethod("match_all")}
                />
                <span>Designs which match all of these criteria</span>
              </label>
            </div>

            <div style={savedSearchBox}>
              <div style={boxTitle}>Saved Search</div>
              <select
                className="select"
                value={savedSearchId}
                onChange={(e) => applySavedSearch(e.target.value)}
              >
                <option value="">(None)</option>
                {savedSearches.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.is_shared ? `🌐 ${s.name}` : s.name}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSaveName(selectedSavedSearch?.name ?? "");
                    setSaveShared(!!selectedSavedSearch?.is_shared);
                    setSaveOpen(true);
                  }}
                >
                  Add
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!selectedSavedSearch || !selectedSavedSearch.is_owner}
                  onClick={deleteCurrentSavedSearch}
                >
                  Delete
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!selectedSavedSearch || !selectedSavedSearch.is_owner}
                  onClick={updateCurrentSavedSearch}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={footer}>
          <button type="button" className="btn btn-secondary" onClick={resetAll}>
            Reset
          </button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary" disabled>
              Help
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const committedFilters: WorkflowSearchFilters = {
                  ...localFilters,
                  salesOrderNumbers: parseCommaList(salesOrderDraft),
                  poNumbers: parseCommaList(poDraft),
                  tapeNames: parseCommaList(tapeNameDraft),
                  instructionsTerms: parseCommaList(instructionsDraft),
                  tapeNumbers: parseCommaList(tapeNumberDraft),
                  sampleSoNumbers: parseCommaList(sampleSoDraft),
                  stitchCounts: parseCommaList(stitchCountDraft),
                };

                setLocalFilters(committedFilters);

                setSalesOrderDraft(joinCommaList(committedFilters.salesOrderNumbers));
                setPoDraft(joinCommaList(committedFilters.poNumbers));
                setTapeNameDraft(joinCommaList(committedFilters.tapeNames));
                setInstructionsDraft(joinCommaList(committedFilters.instructionsTerms));
                setTapeNumberDraft(joinCommaList(committedFilters.tapeNumbers));
                setSampleSoDraft(joinCommaList(committedFilters.sampleSoNumbers));
                setStitchCountDraft(joinCommaList(committedFilters.stitchCounts));

                onApply({
                  filters: committedFilters,
                  savedSearchId,
                  searchMethod,
                });
              }}
            >
              OK
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {saveOpen ? (
        <div style={dialogOverlay}>
          <div style={dialogCard}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Save Search</div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={fieldLabel}>Enter a unique name</label>
                <input
                  className="input"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
              </div>

              <label style={radioRow}>
                <input
                  type="checkbox"
                  checked={saveShared}
                  onChange={(e) => setSaveShared(e.target.checked)}
                />
                <span>Shared with other users</span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={createSavedSearch}
                disabled={saveBusy || !saveName.trim()}
              >
                {saveBusy ? "Saving..." : "OK"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSaveOpen(false)}
                disabled={saveBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 10,
        alignItems: "center",
      }}
    >
      <label style={fieldLabel}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function MultiSelectPicker({
  options,
  selected,
  onChange,
  openUp = false,
}: {
  options: WorkflowOptionRow[];
  selected: string[];
  onChange: (next: string[]) => void;
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return selected.map((v) => map.get(v) ?? v);
  }, [options, selected]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((x) => x !== value));
      return;
    }
    onChange([...selected, value]);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ width: "100%", justifyContent: "space-between" }}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLabels.length ? selectedLabels.join(", ") : "(Any)"}
        </span>
        <span>▾</span>
      </button>

      {open ? (
        <div
          style={{
            ...pickerPanel,
            ...(openUp
              ? { bottom: "calc(100% + 6px)", top: "auto" }
              : { top: "calc(100% + 6px)", bottom: "auto" }),
          }}
        >
          <input
            className="input"
            placeholder="Filter values..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 8 }}
          />

          <div style={pickerList}>
            {filtered.map((opt) => (
              <label key={opt.value} style={pickerRow}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 8,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onChange([])}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,17,17,0.32)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 24,
};

const windowStyle: React.CSSProperties = {
  width: "min(1180px, 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflow: "visible",
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: 10,
  boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
};

const titleBar: React.CSSProperties = {
  background: "var(--brand-blue)",
  color: "#fff",
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderTopLeftRadius: 10,
  borderTopRightRadius: 10,
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

const tabsRow: React.CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "10px 10px 0 10px",
  background: "#f3f3f3",
  borderBottom: "1px solid #d8d8d8",
};

const activeTab: React.CSSProperties = {
  padding: "8px 12px",
  background: "#fff",
  borderTop: "1px solid #d8d8d8",
  borderRight: "1px solid #d8d8d8",
  borderLeft: "1px solid #d8d8d8",
  borderBottom: "1px solid #fff",
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  fontSize: 13,
  fontWeight: 700,
};

const inactiveTab: React.CSSProperties = {
  padding: "8px 12px",
  background: "#ececec",
  borderTop: "1px solid #d8d8d8",
  borderRight: "1px solid #d8d8d8",
  borderLeft: "1px solid #d8d8d8",
  borderBottom: "1px solid #d8d8d8",
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  fontSize: 13,
  color: "#666",
};

const body: React.CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 18,
  overflow: "visible",
};

const fieldsWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 360px",
  gap: 28,
  overflow: "visible",
};

const leftCol: React.CSSProperties = {
  display: "grid",
  gap: 10,
  overflow: "visible",
};

const rightCol: React.CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
  overflow: "visible",
};

const bottomRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 260px",
  gap: 14,
  overflow: "visible",
};

const searchMethodBox: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 12,
  background: "var(--surface-subtle)",
};

const savedSearchBox: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 12,
  background: "var(--surface-subtle)",
};

const boxTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 13,
  marginBottom: 10,
};

const radioRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
  fontSize: 13,
};

const footer: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 14,
  borderTop: "1px solid var(--border)",
  background: "var(--surface-muted)",
  borderBottomLeftRadius: 10,
  borderBottomRightRadius: 10,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text)",
};

const pickerPanel: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  zIndex: 20,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  padding: 8,
};

const pickerList: React.CSSProperties = {
  maxHeight: 220,
  overflow: "auto",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 6,
  display: "grid",
  gap: 6,
};

const pickerRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 13,
};

const dialogOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,17,17,0.32)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1100,
};

const dialogCard: React.CSSProperties = {
  width: 360,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
};