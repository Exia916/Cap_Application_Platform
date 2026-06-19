// app/quick-turn-quote-calculator/QuickTurnCustomerExportSetupClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";
import type {
  QuickTurnCustomerExportDetail,
  QuickTurnCustomerExportItem,
  QuickTurnCustomerExportSelectedBreak,
} from "./types";

const QUICK_TURN_QUOTE_ENTITY_TYPE = "quick_turn_quote";

function fmtDate(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function fmtMoney(value?: number | string | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function selectedIds(item: QuickTurnCustomerExportItem) {
  return new Set(item.selectedBreaks.map((row) => row.resultId));
}

function quoteStatusPill(row: QuickTurnCustomerExportDetail) {
  if (row.isVoided) return <span className="record-pill record-pill-danger">Voided</span>;
  if (row.quoteStatus === "DRAFT") return <span className="record-pill record-pill-warning">Draft</span>;
  return <span className="record-pill record-pill-success">Published</span>;
}

function cloneExport(row: QuickTurnCustomerExportDetail): QuickTurnCustomerExportDetail {
  return JSON.parse(JSON.stringify(row));
}

function mergeRefreshedImages(
  current: QuickTurnCustomerExportDetail,
  refreshed: QuickTurnCustomerExportDetail,
  selectedQuoteItemId?: string
): QuickTurnCustomerExportDetail {
  const copy = cloneExport(current);
  const refreshedItems = new Map(refreshed.items.map((item) => [item.quoteItemId, item]));

  copy.items = copy.items.map((item) => {
    const refreshedItem = refreshedItems.get(item.quoteItemId);
    if (!refreshedItem) return item;

    const shouldApplySelectedImage = selectedQuoteItemId === item.quoteItemId;

    return {
      ...item,
      availableImageAttachments: refreshedItem.availableImageAttachments || [],
      imageAttachmentId: shouldApplySelectedImage ? refreshedItem.imageAttachmentId : item.imageAttachmentId,
      imageAttachment: shouldApplySelectedImage ? refreshedItem.imageAttachment : item.imageAttachment,
    };
  });

  return copy;
}

async function fetchCustomerExport(id: string): Promise<QuickTurnCustomerExportDetail> {
  const res = await fetch(
    `/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(id)}/customer-export?includeVoided=true`,
    { cache: "no-store", credentials: "include" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to load customer quote setup.");
  return data?.row as QuickTurnCustomerExportDetail;
}


type CustomerImageAttachment = QuickTurnCustomerExportItem["availableImageAttachments"][number];

function isImageAttachment(att: CustomerImageAttachment) {
  const mime = String(att.mimeType || "").toLowerCase();
  const name = String(att.originalFileName || "").toLowerCase();
  return (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name) ||
    att.canPreviewInline === true
  );
}

function uniqueAttachments(rows: CustomerImageAttachment[]) {
  const byId = new Map<number, CustomerImageAttachment>();
  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    if (!isImageAttachment(row)) continue;
    byId.set(id, { ...row, id });
  }
  return Array.from(byId.values()).sort((a, b) => Number(b.id) - Number(a.id));
}

async function fetchImageAttachmentsForCategories(quoteId: string, categories: string[]) {
  const all: CustomerImageAttachment[] = [];
  const uniqueCategories = Array.from(new Set(["general", ...categories].filter(Boolean)));

  for (const category of uniqueCategories) {
    const params = new URLSearchParams({
      entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
      entityId: quoteId,
      attachmentCategory: category,
      limit: "500",
    });

    const res = await fetch(`/api/platform/attachments?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
    });

    if (!res.ok) continue;
    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    all.push(...rows);
  }

  return uniqueAttachments(all);
}

async function withLatestImageChoices(detail: QuickTurnCustomerExportDetail) {
  const categories = detail.items.map((item) => item.imageAttachmentCategory).filter(Boolean);
  const apiChoices = await fetchImageAttachmentsForCategories(detail.quoteId, categories);
  const existingChoices = detail.items.flatMap((item) => item.availableImageAttachments || []);
  const choices = uniqueAttachments([...existingChoices, ...apiChoices]);
  const choicesById = new Map(choices.map((att) => [Number(att.id), att]));

  return {
    ...detail,
    items: detail.items.map((item) => {
      const imageId = item.imageAttachmentId == null ? null : Number(item.imageAttachmentId);
      return {
        ...item,
        imageAttachmentId: imageId,
        availableImageAttachments: choices,
        imageAttachment: imageId ? choicesById.get(imageId) ?? item.imageAttachment ?? null : null,
      };
    }),
  };
}


export default function QuickTurnCustomerExportSetupClient({ id }: { id: string }) {
  const [row, setRow] = useState<QuickTurnCustomerExportDetail | null>(null);
  const [draft, setDraft] = useState<QuickTurnCustomerExportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  const canEdit = !!draft && !draft.isVoided;
  const canEditQuoteHeader = !!draft && draft.quoteStatus === "DRAFT" && !draft.isVoided;

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const next = await withLatestImageChoices(await fetchCustomerExport(id));
      setRow(next);
      setDraft(cloneExport(next));
    } catch (err: any) {
      setError(err?.message || "Failed to load customer quote setup.");
      setRow(null);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function updateHeader(updater: (current: QuickTurnCustomerExportDetail) => QuickTurnCustomerExportDetail) {
    setDraft((current) => (current ? updater(cloneExport(current)) : current));
    setSuccess(null);
  }

  function updateItem(
    quoteItemId: string,
    updater: (current: QuickTurnCustomerExportItem) => QuickTurnCustomerExportItem
  ) {
    setDraft((current) => {
      if (!current) return current;
      const copy = cloneExport(current);
      copy.items = copy.items.map((item) => (item.quoteItemId === quoteItemId ? updater({ ...item }) : item));
      return copy;
    });
    setSuccess(null);
  }

  function toggleBreak(item: QuickTurnCustomerExportItem, breakRow: QuickTurnCustomerExportSelectedBreak) {
    updateItem(item.quoteItemId, (current) => {
      const ids = selectedIds(current);
      const selected = current.selectedBreaks.filter((row) => row.resultId !== breakRow.resultId);
      if (!ids.has(breakRow.resultId)) selected.push(breakRow);
      selected.sort((a, b) => a.minQuantity - b.minQuantity);
      return { ...current, selectedBreaks: selected };
    });
  }

  function buildSavePayload(source: QuickTurnCustomerExportDetail) {
    return {
      selectedCalculatorId: source.selectedCalculatorId,
      selectedCalculatorCode: source.selectedCalculatorCode,
      capProgramName: source.capProgramName,
      customerServiceContact: source.customerServiceContact,
      sampleProductionDetails: source.sampleProductionDetails,
      productionTimeDetails: source.productionTimeDetails,
      additionalInformation: source.additionalInformation,
      items: source.items.map((item) => ({
        quoteItemId: item.quoteItemId,
        optionLabel: item.optionLabel,
        customerDescription: item.customerDescription,
        customerNotes: item.customerNotes,
        factoryDisplay: item.factoryDisplay,
        selectedBreakResultIds: item.selectedBreaks.map((breakRow) => breakRow.resultId),
        selectedMethodCode: item.selectedMethodCode,
        imageAttachmentId: item.imageAttachmentId,
        sortOrder: item.sortOrder,
      })),
    };
  }

  async function saveSetup(options?: { silent?: boolean }): Promise<QuickTurnCustomerExportDetail | null> {
    if (!draft || !canEdit) return draft;
    try {
      setSaving(true);
      setError(null);
      if (!options?.silent) setSuccess(null);

      const res = await fetch(`/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(id)}/customer-export`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildSavePayload(draft)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save customer quote setup.");

      const next = await withLatestImageChoices(data?.row as QuickTurnCustomerExportDetail);
      setRow(next);
      setDraft(cloneExport(next));
      if (!options?.silent) setSuccess("Customer quote setup saved.");
      return next;
    } catch (err: any) {
      setError(err?.message || "Failed to save customer quote setup.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function previewCustomerQuote() {
    const printUrl = `/quick-turn-quote-calculator/saved/${encodeURIComponent(id)}/customer-print`;
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.document.write("<p style='font-family: Arial, sans-serif;'>Preparing customer quote preview…</p>");
    }

    if (canEdit) {
      const saved = await saveSetup({ silent: true });
      if (!saved) {
        if (previewWindow) previewWindow.close();
        return;
      }
    }

    if (previewWindow) {
      previewWindow.location.href = printUrl;
    } else {
      window.open(printUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function updateImage(quoteItemId: string, attachmentId: number | null) {
    try {
      setRefreshingImages(true);
      setError(null);
      setSuccess(null);
      const res = await fetch(
        `/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(id)}/customer-export/items/${encodeURIComponent(quoteItemId)}/image`,
        {
          method: attachmentId === null ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: attachmentId === null ? undefined : JSON.stringify({ attachmentId }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update item image.");
      const next = await withLatestImageChoices(data?.row as QuickTurnCustomerExportDetail);
      setRow(next);
      setDraft((current) =>
        current ? mergeRefreshedImages(current, next, quoteItemId) : cloneExport(next)
      );
      setSuccess(attachmentId === null ? "Customer image removed." : "Customer image selected.");
    } catch (err: any) {
      setError(err?.message || "Failed to update item image.");
    } finally {
      setRefreshingImages(false);
    }
  }

  async function refreshImages() {
    try {
      setRefreshingImages(true);
      setError(null);
      const source = draft ?? row ?? (await fetchCustomerExport(id));
      const next = await withLatestImageChoices(source);
      setRow((current) => (current ? mergeRefreshedImages(current, next) : cloneExport(next)));
      setDraft((current) => (current ? mergeRefreshedImages(current, next) : cloneExport(next)));
      setSuccess("Image choices refreshed.");
    } catch (err: any) {
      setError(err?.message || "Failed to refresh image choices.");
    } finally {
      setRefreshingImages(false);
    }
  }

  const filteredBreaksByItem = useMemo(() => {
    const map = new Map<string, QuickTurnCustomerExportSelectedBreak[]>();
    if (!draft) return map;
    for (const item of draft.items) {
      map.set(
        item.quoteItemId,
        item.availableBreaks.filter((breakRow) => breakRow.calculatorCode === draft.selectedCalculatorCode)
      );
    }
    return map;
  }, [draft]);

  if (loading) {
    return (
      <main className="record-shell">
        <div className="card">Loading customer quote setup…</div>
      </main>
    );
  }

  if (error && !draft) {
    return (
      <main className="record-shell">
        <div className="alert alert-danger">{error}</div>
        <div style={{ marginTop: 12 }}>
          <Link href={`/quick-turn-quote-calculator/saved/${encodeURIComponent(id)}`} className="btn btn-secondary">
            Back to Saved Quote
          </Link>
        </div>
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="record-shell">
        <div className="alert alert-warning">Customer quote setup was not found.</div>
      </main>
    );
  }

  return (
    <main className="record-shell">
      <div className="record-header">
        <div className="record-header-main">
          <div className="record-kicker">Quick Turn / Customer Quote Setup</div>
          <h1 className="record-title">{draft.quoteName || draft.quoteNumber}</h1>
          <p className="record-subtitle">
            Internal CAP quote {draft.quoteNumber} · Valid through {fmtDate(draft.validUntil)}
          </p>
          <div className="record-badge-row">
            {quoteStatusPill(draft)}
            {draft.selectedCalculatorName ? (
              <span className="record-pill record-pill-info">{draft.selectedCalculatorName}</span>
            ) : null}
            {draft.exists ? <span className="record-pill record-pill-neutral">Setup saved</span> : <span className="record-pill record-pill-warning">Setup not saved yet</span>}
          </div>
        </div>
        <div className="record-actions">
          <Link href={`/quick-turn-quote-calculator/saved/${encodeURIComponent(id)}`} className="btn btn-secondary">
            Back
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => void previewCustomerQuote()} disabled={saving}>
            Preview Customer Quote
          </button>
          {canEdit ? (
            <button type="button" className="btn btn-primary" onClick={() => void saveSetup()} disabled={saving}>
              {saving ? "Saving…" : "Save Customer Quote Setup"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}
      {draft.isVoided ? (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          This quote is voided and customer-facing setup is locked.
          {draft.voidReason ? ` Reason: ${draft.voidReason}` : ""}
        </div>
      ) : null}
      {draft.quoteStatus === "PUBLISHED" && !draft.isVoided ? (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          This quote is published, so the internal quote pricing and quote header are locked. Customer-facing print setup can still be adjusted for formatting, selected breaks, customer notes, photos, and print details.
        </div>
      ) : null}

      <section className="record-section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Customer Quote Header</h2>
          {canEditQuoteHeader ? (
            <Link href={`/quick-turn-quote-calculator?edit=${encodeURIComponent(id)}`} className="btn btn-secondary btn-sm">
              Edit Quote Header
            </Link>
          ) : null}
        </div>
        <div className="record-meta-grid">
          <div className="record-meta-item">
            <div className="record-meta-label">Customer Quote # / Quote Name</div>
            <div className="record-meta-value">{draft.quoteName || "—"}</div>
          </div>
          <div className="record-meta-item">
            <div className="record-meta-label">Workflow SO / Reference #</div>
            <div className="record-meta-value">{draft.workflowSalesOrderNumber || "—"}</div>
          </div>
          <div className="record-meta-item">
            <div className="record-meta-label">Program Logo Text</div>
            <div className="record-meta-value">{draft.programLogoText || "—"}</div>
          </div>
          <div className="record-meta-item">
            <div className="record-meta-label">FOB / Destination</div>
            <div className="record-meta-value">{draft.fob || "—"}</div>
          </div>
          <div className="record-meta-item record-meta-item-full">
            <div className="record-meta-label">Quote Prepared For</div>
            <div className="record-meta-value">{draft.quotePreparedForDisplay || draft.preparedForCustomerNameSnapshot || "—"}</div>
          </div>
          <label>
            <span>Selected Method</span>
            <select
              className="select"
              value={draft.selectedCalculatorCode || ""}
              disabled={!canEdit}
              onChange={(e) =>
                updateHeader((current) => {
                  const selected = current.availableCalculators.find((x) => x.code === e.target.value) || null;
                  return {
                    ...current,
                    selectedCalculatorId: selected?.id ?? null,
                    selectedCalculatorCode: selected?.code ?? null,
                    selectedCalculatorName: selected?.name ?? null,
                    items: current.items.map((item) => ({ ...item, selectedBreaks: [] })),
                  };
                })
              }
            >
              {draft.availableCalculators.map((calculator) => (
                <option key={calculator.code} value={calculator.code}>
                  {calculator.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>CAP America Program</span>
            <input
              className="input"
              value={draft.capProgramName || ""}
              disabled={!canEdit}
              onChange={(e) => updateHeader((current) => ({ ...current, capProgramName: e.target.value }))}
            />
          </label>
          <label className="record-meta-item-full">
            <span>Sample Production Details</span>
            <textarea
              className="textarea"
              value={draft.sampleProductionDetails || ""}
              disabled={!canEdit}
              rows={2}
              onChange={(e) => updateHeader((current) => ({ ...current, sampleProductionDetails: e.target.value }))}
            />
          </label>
          <label className="record-meta-item-full">
            <span>Production Time / Delivery Details</span>
            <textarea
              className="textarea"
              value={draft.productionTimeDetails || ""}
              disabled={!canEdit}
              rows={2}
              onChange={(e) => updateHeader((current) => ({ ...current, productionTimeDetails: e.target.value }))}
            />
          </label>
          <label className="record-meta-item-full">
            <span>Customer Service Contact</span>
            <input
              className="input"
              value={draft.customerServiceContact || ""}
              disabled={!canEdit}
              onChange={(e) => updateHeader((current) => ({ ...current, customerServiceContact: e.target.value }))}
              placeholder="Example: Regina Terrell"
            />
          </label>
          <label className="record-meta-item-full">
            <span>Additional Information</span>
            <textarea
              className="textarea"
              value={draft.additionalInformation || ""}
              disabled={!canEdit}
              rows={4}
              onChange={(e) => updateHeader((current) => ({ ...current, additionalInformation: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <div className="record-content">
        {draft.items.map((item, index) => {
          const allowedBreaks = filteredBreaksByItem.get(item.quoteItemId) ?? [];
          const ids = selectedIds(item);
          return (
            <section className="record-section-card" key={item.quoteItemId}>
              <div className="record-section-header">
                <h2 className="record-section-title">{item.optionLabel || `Option ${index + 1}`}</h2>
                <span className="record-pill record-pill-neutral">{item.baseItemCode}</span>
              </div>

              <div className="record-meta-grid">
                <label>
                  <span>Option Label</span>
                  <input
                    className="input"
                    value={item.optionLabel || ""}
                    disabled={!canEdit}
                    onChange={(e) => updateItem(item.quoteItemId, (current) => ({ ...current, optionLabel: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Factory Display</span>
                  <input
                    className="input"
                    value={item.factoryDisplay || ""}
                    disabled={!canEdit}
                    onChange={(e) => updateItem(item.quoteItemId, (current) => ({ ...current, factoryDisplay: e.target.value }))}
                    placeholder="Example: JF"
                  />
                </label>
                <label className="record-meta-item-full">
                  <span>Customer-Facing Description</span>
                  <textarea
                    className="textarea"
                    value={item.customerDescription || ""}
                    disabled={!canEdit}
                    rows={4}
                    onChange={(e) => updateItem(item.quoteItemId, (current) => ({ ...current, customerDescription: e.target.value }))}
                  />
                </label>
                <label className="record-meta-item-full">
                  <span>Customer-Facing Notes</span>
                  <textarea
                    className="textarea"
                    value={item.customerNotes || ""}
                    disabled={!canEdit}
                    rows={3}
                    onChange={(e) => updateItem(item.quoteItemId, (current) => ({ ...current, customerNotes: e.target.value }))}
                    placeholder="Only notes entered here will show on the customer quote."
                  />
                </label>
              </div>

              <div style={{ marginTop: 16 }}>
                <h3 className="record-section-title" style={{ fontSize: 15 }}>
                  Selected Quantity Breaks for Customer Quote
                </h3>
                {allowedBreaks.length === 0 ? (
                  <div className="muted-box">No quantity breaks found for the selected method.</div>
                ) : (
                  <div className="table-card">
                    <div className="table-scroll">
                      <table className="table-clean">
                        <thead>
                          <tr>
                            <th>Show</th>
                            <th>Qty / Break</th>
                            <th>Net Price</th>
                            <th>Review</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allowedBreaks.map((breakRow) => (
                            <tr key={breakRow.resultId}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={ids.has(breakRow.resultId)}
                                  disabled={!canEdit}
                                  onChange={() => toggleBreak(item, breakRow)}
                                />
                              </td>
                              <td>{breakRow.quantityLabel || breakRow.breakLabel}</td>
                              <td>{fmtMoney(breakRow.unitPrice)}</td>
                              <td>{breakRow.managementReviewRequired ? "Management review" : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="record-section-header">
                  <h3 className="record-section-title" style={{ fontSize: 15 }}>
                    Customer Quote Photo
                  </h3>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={refreshImages} disabled={refreshingImages}>
                    Refresh Images
                  </button>
                </div>
                {canEdit ? (
                  <div style={{ marginBottom: 12 }}>
                    <AttachmentsPanel
                      entityType={QUICK_TURN_QUOTE_ENTITY_TYPE}
                      entityId={draft.quoteId}
                      attachmentCategory={item.imageAttachmentCategory}
                      emptyMessage="No item photos uploaded yet."
                      dialogTitle={`${item.optionLabel || "Option"} Customer Photo`}
                    />
                  </div>
                ) : null}
                <div className="record-meta-grid">
                  <label>
                    <span>Selected Photo</span>
                    <select
                      className="select"
                      disabled={!canEdit}
                      value={String(item.imageAttachmentId || "")}
                      onFocus={() => {
                        if (canEdit) void refreshImages();
                      }}
                      onChange={(e) => updateImage(item.quoteItemId, e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">No photo selected</option>
                      {item.availableImageAttachments.map((att) => (
                        <option key={att.id} value={String(att.id)}>
                          {att.originalFileName}
                        </option>
                      ))}
                    </select>
                    {canEdit && item.availableImageAttachments.length === 0 ? (
                      <small className="muted-text">
                        Upload a photo above, then click Refresh Images if it does not appear automatically.
                      </small>
                    ) : null}
                  </label>
                  {item.imageAttachmentId ? (
                    <div>
                      <span>Preview</span>
                      <div style={{ marginTop: 6 }}>
                        <img
                          src={`/api/platform/attachments/${item.imageAttachmentId}`}
                          alt={item.imageAttachment?.originalFileName || item.optionLabel}
                          style={{ maxWidth: 220, maxHeight: 160, objectFit: "contain", border: "1px solid var(--border)" }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canEdit ? (
          <button type="button" className="btn btn-primary" onClick={() => void saveSetup()} disabled={saving}>
            {saving ? "Saving…" : "Save Customer Quote Setup"}
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={() => void previewCustomerQuote()} disabled={saving}>
          Preview Customer Quote
        </button>
        <Link href={`/quick-turn-quote-calculator/saved/${encodeURIComponent(id)}`} className="btn btn-secondary">
          Back to Saved Quote
        </Link>
      </div>
    </main>
  );
}
