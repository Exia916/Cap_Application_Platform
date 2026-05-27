# Reporting Architecture

**Last updated:** 2026-05-22

Reporting is a shared CAP platform capability. Module data should be structured so it can support operational dashboards, management reporting, exports, Metabase, productivity analysis, and future AI-assisted decision support.

---

## Reporting Objectives

CAP reporting should provide visibility into:

- Production totals.
- Operator output.
- Department output.
- Shift performance.
- Quality results.
- Recut trends.
- Maintenance/CMMS work orders.
- Workflow workload and status.
- Task assignments, aging, overdue work, and completion.
- Shipment milestones.
- Compliance expirations/renewals.
- Product/spec/BOM changes.
- Integration health.

---

## Reporting Principles

All modules should follow these reporting principles:

- Capture structured data instead of relying only on notes.
- Use consistent date and shift fields.
- Exclude voided records by default.
- Preserve stable user, department, role, machine, location, item, vendor, and sales order references where possible.
- Normalize sales order values into display/base fields where applicable.
- Keep business definitions documented in a KPI registry/data dictionary.
- Support both operational list exports and manager-level dashboards.
- Avoid reporting calculations that depend on inconsistent UI-only labels.

---

## Standard Date and Shift Logic

Production and shift-based reporting should prefer `shift_date` when the business question is shift-based.

Common date fields:

```text
entry_ts
entry_date
shift_date
requested_date
due_date
completed_at
created_at
updated_at
```

Timezone standard:

```text
America/Chicago
```

Embroidery-style shift rules:

- Day shift: 06:00-17:59.
- Night shift: 18:00-05:59.
- Night entries from 00:00-05:59 roll back to the prior `shift_date`.

---

## Voided Record Reporting Rule

Voided records should be excluded from normal reporting by default.

Use:

```sql
COALESCE(is_voided, false) = false
```

Admin/debug reports may include or isolate voided records, but dashboards and standard exports should exclude them unless clearly labeled.

---

## Sales Order Reporting Rule

Where applicable, use:

```text
sales_order_display  # user-facing order value
sales_order_base     # normalized order value for linking/reporting
```

Reporting can display `sales_order_display` while grouping or linking by `sales_order_base` when appropriate.

---

## Reporting Data Sources

Primary CAP reporting sources:

- PostgreSQL operational tables.
- Platform service tables: comments, attachments metadata, activity history, tasks, task events, notifications, approvals.
- Master data / lookup tables.
- Integration health tables when available.

External/future reporting sources:

- SBT / ERP.
- Wilcom.
- B-Net / machine telemetry.
- Paycom or labor source if labor efficiency reporting is added.
- Amazon S3 metadata references.
- Metabase dashboards.

---

## Current Reporting Areas

### Production Reporting

Should support reporting by:

- Date.
- Shift date.
- Shift.
- Operator/user.
- Department.
- Machine/location.
- Sales order.
- Detail number.
- Item/style.
- Quantity/pieces.
- Module-specific metrics such as stitches, inspected quantity, rejects, emblem type, laser output, or knit production area.

### Recut Reporting

Should support reporting by:

- Requested date.
- Requested department.
- Sales order.
- Recut reason.
- Cap style.
- Pieces.
- Operator.
- Supervisor approval.
- Warehouse printed status.
- Do Not Pull status.
- Voiding status for admin/audit views.

### CMMS / Maintenance Reporting

Should support reporting by:

- Request date.
- Department.
- Asset/machine.
- Priority.
- Status.
- Tech.
- Downtime.
- Resolution.
- Common issue.
- Aging/open work.

### Workflow and Task Reporting

Should support reporting by:

- Workflow status.
- Assigned digitizer/designer.
- Task owner.
- Task status.
- Due/overdue work.
- Reassignment count.
- Completion time.
- Manager workload.
- Notification delivery history.

### Logistics / Inbound Shipment Reporting

Should support reporting by:

- Container.
- Factory/vendor.
- Purchase order.
- Sales order.
- Destination.
- Shipment milestone.
- ETA/arrival date.
- Missing documents.
- Follow-up tasks.

### Compliance / Product Data Reporting

Should support reporting by:

- Item/product.
- Compliance category.
- Document type.
- Expiration date.
- Renewal owner.
- Approval status.
- Revision status.
- Missing/expired documents.

---

## KPI Registry / Data Dictionary

A KPI registry should become the official source for metric definitions.

Each KPI should document:

| Field | Description |
| --- | --- |
| Metric Name | Business-facing metric name. |
| Definition | Plain-language definition. |
| Formula | SQL/calculation logic. |
| Source Tables | Tables/views used. |
| Date Logic | Calendar date, shift date, requested date, completed date, etc. |
| Voiding Rule | Whether voided records are excluded. |
| Owner | Business owner responsible for the definition. |
| Refresh Expectation | Real-time, daily, manual, etc. |
| Used By | Dashboards/reports using the metric. |

Create KPI definitions before building complex productivity dashboards.

---

## DataTable Export Standard

List pages using the shared DataTable should support CSV export where useful.

Export rules:

- Export should reflect the current filtered view unless otherwise documented.
- Exported columns should use business-friendly labels.
- Date and status fields should be readable.
- Voided records should remain excluded unless the view explicitly includes them.

---

## Dashboard Standards

Dashboards should:

- Use clear date ranges and filter state.
- Avoid excessive API calls for the same selected date/range.
- Prefer consolidated metrics endpoints where practical.
- Show loading/error states.
- Use consistent KPI names and definitions.
- Provide links back to underlying records or filtered list pages.

---

## Metabase / Analytics Layer

Metabase remains a strong option for broader reporting, especially cross-module and cross-system reporting.

CAP data should be structured so Metabase can consume it cleanly:

- Consistent table/column names.
- Stable date fields.
- Clean lookup/master data references.
- Consistent status values.
- Standard voided-record behavior.
- Clear KPI definitions.

---

## Reporting Build Checklist

Before building a new report/dashboard, confirm:

- [ ] Business owner.
- [ ] Intended audience.
- [ ] KPI definitions.
- [ ] Source tables/fields.
- [ ] Date/shift logic.
- [ ] Voided-record behavior.
- [ ] Filters needed.
- [ ] Export needs.
- [ ] Drill-down/list-page links.
- [ ] Refresh/performance expectations.
