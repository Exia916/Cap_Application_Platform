# Module Development Standard

**Last updated:** 2026-05-22

All CAP modules should follow a consistent implementation pattern so the platform remains maintainable, secure, familiar to users, and reporting-ready.

---

## Module Standard Summary

Every module should be designed around these core parts:

| Area | Standard |
| --- | --- |
| List Page | Shared `DataTable` with filtering, sorting, pagination, actions, and export support. |
| Create/Edit Form | Consistent form layout, validation, save/cancel behavior, and error handling. |
| Record View | Detail view with record summary, metadata, actions, and shared panels where applicable. |
| API Routes | Thin route handlers with auth/permissions and delegation to repositories/services. |
| Repository/Service | Centralized SQL, business rules, filtering, sorting, pagination, and actions. |
| Platform Services | Comments, attachments, activity history, voiding, tasks, approvals, and notifications as applicable. |
| Reporting | Clean structured data, consistent dates, status rules, and export/dashboard readiness. |

---

## Standard Module File Pattern

Preferred route pattern:

```text
app/<module>/page.tsx
app/<module>/add/page.tsx                # or new/page.tsx
app/<module>/[id]/page.tsx
app/<module>/[id]/edit/page.tsx
```

Preferred API pattern:

```text
app/api/<module>/route.ts
app/api/<module>/[id]/route.ts
app/api/<module>/[id]/void/route.ts
app/api/<module>/[id]/unvoid/route.ts
app/api/<module>/[id]/<action>/route.ts
```

Preferred repository pattern:

```text
lib/repositories/<module>Repo.ts
```

Shared helpers:

```text
lib/repositories/_shared/repoFilters.ts
lib/repositories/_shared/repoTypes.ts
lib/repositories/_shared/voiding.ts
```

Shared platform components:

```text
components/platform/CommentsPanel.tsx
components/platform/AttachmentsPanel.tsx
components/platform/ActivityHistoryPanel.tsx
```

---

## Required Module Planning Questions

Before building a module, define:

- Who can view, create, edit, void, approve, export, and administer the records?
- What is the main record entity?
- Does the record have line items?
- Does the record need attachments, comments, and activity history?
- Should records be voided instead of deleted?
- Which fields are required for reporting?
- Which dates should be stored: entry date, requested date, due date, shift date, completion date?
- Does the module need tasks or assignments?
- Does the module need notifications?
- Does the module need approvals?
- Does the module need revisions/versioning?
- Does the module need document expiration/renewal tracking?
- Does the module link to sales orders, purchase orders, users, vendors/factories, items, or external systems?

---

## List Page Standard

List pages should use the shared `DataTable` component by default.

Expected features:

- Page title and subtitle.
- Create button when the user has permission.
- Server-side pagination for larger data sets.
- Sorting.
- Column-level filters.
- Text contains filters for fields with many possible values.
- Dropdown filters only for small controlled lists.
- CSV export where appropriate.
- Row action buttons.
- Loading state.
- Error state.
- Empty state.
- Row highlighting where business rules require it.

List pages should not pull unbounded record sets into the browser.

---

## Create/Edit Form Standard

Forms should use shared global styling and consistent section layouts.

Recommended form sections:

- Record identity / header.
- Date and shift fields.
- Sales order or external reference fields.
- Assignment/ownership fields.
- Status/workflow fields.
- Quantity/metrics fields.
- Line items or detail records.
- Notes/comments where needed.
- Attachments where needed.

Form rules:

- Use field-level validation.
- Keep required-field indicators consistent.
- Preserve entered values on validation errors.
- Disable submit while saving.
- Prevent editing voided records.
- Use controlled lookups for master-data fields.
- Avoid one-off styling.

---

## Record View Standard

Record/detail pages should provide a clear operational view.

Recommended layout:

```text
Record Header
  - Title / record ID
  - Status badge
  - Key metadata
  - Primary actions

Main Detail Area
  - Summary card
  - Module-specific sections
  - Line/details table if applicable

Shared Record Support
  - Attachments
  - Comments
  - Activity History
  - Tasks/Assignments where applicable
  - Approvals/Revisions/Document expiration where applicable
```

The shared support area may be a right sidebar, stacked panels, tabs, or a module-specific layout if the record is complex.

---

## API Route Standard

API routes should handle boundary concerns only:

- Read authentication.
- Enforce permissions.
- Parse input/search params.
- Validate basic request shape.
- Call repository/service.
- Return JSON.

Avoid placing complex SQL, workflow rules, notification delivery, or integration logic directly in route handlers.

---

## Repository Standard

Each module repository should expose a consistent set of functions where applicable:

```ts
list(args)
getById(id, options)
create(input)
update(id, input)
replace(id, input)
void(id, user, reason)
unvoid(id, user)
```

List functions should support:

- Filtering.
- Sorting.
- Pagination.
- Total counts.
- Optional include/only voided modes for admin workflows.
- Safe parameterized SQL.

Repositories should own database-specific details and return typed rows to API routes.

---

## Shared Platform Service Integration

Use platform services instead of one-off implementations.

| Capability | Module Guidance |
| --- | --- |
| Activity History | Log creates, updates, status changes, voiding, comments, attachments, task actions, and approvals. |
| Comments | Use record-linked comments for notes/investigation context. |
| Attachments | Use S3-backed shared attachment service. |
| Voiding | Use standard void fields when records should be removed from normal use. |
| Tasks | Use shared task records for assigned work, due dates, and completion. |
| Notifications | Generate from events/tasks, not scattered direct emails. |
| Approvals | Use shared approval framework when routing, review, or rejection history is needed. |
| Revisions | Use shared versioning for specs, BOMs, quote rules, compliance documents, playbooks, or templates. |
| Document Expiration | Use shared expiration/renewal service for certificates, test reports, compliance docs, and vendor/factory docs. |

---

## Permission Standard

Each module should define access for:

- List view.
- Detail view.
- Create.
- Edit.
- Void/unvoid.
- Status or workflow actions.
- Export/print.
- Admin configuration.
- Reporting views.

Permissions must be enforced at the API level. UI controls should reflect those permissions, but hidden buttons are not sufficient security.

---

## Data Standard

Where applicable, module records should include:

```text
id
status
created_at
created_by
updated_at
updated_by
is_voided
voided_at
voided_by
void_reason
```

Production/reporting modules should also consider:

```text
entry_ts
entry_date
shift_date
shift
employee_number
name/user reference
department
sales_order_display
sales_order_base
detail_number
quantity/status metrics
```

---

## Reporting Standard

Modules should be built with reporting in mind.

Standards:

- Capture structured fields instead of only free-text notes.
- Use consistent date and shift logic.
- Exclude voided records by default.
- Preserve stable user, department, machine, location, item, vendor, and sales order references where possible.
- Support CSV export on DataTable list pages where useful.
- Align KPIs with the Data Dictionary / KPI Registry as it matures.

---

## New Module Readiness Checklist

Before development starts, confirm:

- [ ] Business owner and pilot users are identified.
- [ ] Workflow map is documented.
- [ ] Roles and permissions are defined.
- [ ] Required fields and reporting fields are defined.
- [ ] Master data lists are identified.
- [ ] Shared services needed are selected.
- [ ] External integrations are identified.
- [ ] Void/edit rules are defined.
- [ ] Notifications/tasks/approvals are classified as platform service usage where applicable.
- [ ] Success measures are defined.

---

## Current High-Priority Module Patterns

### Production-style modules

Use the standard production pattern: entry form, list/DataTable, record view, admin/reporting list, shift/date handling, sales-order normalization, voiding, and reporting-ready data.

### Workflow-style modules

Use record status, status history, assignment fields, task generation, comments, attachments, and activity history. Workflow notifications should be driven by task/workflow events.

### Document-heavy modules

Use attachments, document type/category, owner, expiration date, renewal tasks, approval history, revision/versioning, and reporting filters.

### Logistics/overseas modules

Use shared vendor/factory master data, milestone/status tracking, document attachments, comments, activity history, tasks, and reporting-ready dates.
