# Development Standards

**Last updated:** 2026-05-22

These standards define how CAP code should be structured, styled, secured, and extended.

---

## Core Pattern

Use this default application flow:

```text
UI Page / Component
  ↓
API Route
  ↓
Service / Repository
  ↓
Database / Integration
```

API routes should remain thin. Business rules, SQL, validation helpers, reusable write logic, and integration calls should live in repositories or services.

---

## Technology Standards

| Area | Standard |
| --- | --- |
| Framework | Next.js App Router |
| Language | TypeScript |
| UI | React |
| Styling | Tailwind CSS plus shared `globals.css` tokens/classes |
| API | Next.js route handlers |
| Data Access | Direct SQL through repositories/services |
| Database | PostgreSQL |
| File Storage | Amazon S3 |
| Hosting | Vercel application/API layer; internal/on-prem PostgreSQL |
| Timezone | America/Chicago |

---

## File and Code Organization

Use existing project patterns before introducing new ones.

Typical locations:

```text
app/<module>/...                     # pages and route segments
app/api/<module>/...                 # API routes
components/<module>/...              # module-specific components
components/platform/...              # reusable platform components
lib/repositories/<module>Repo.ts     # database access
lib/repositories/_shared/...         # shared repository helpers
lib/integrations/<system>/...        # external system access
lib/platform/...                     # shared platform service helpers
```

---

## API Route Standards

Route handlers should:

- Authenticate the user.
- Enforce role/permission checks.
- Parse and validate request input.
- Call a repository or service.
- Return a consistent JSON shape.
- Avoid direct SQL when a repository/service belongs to the module.
- Avoid large response payloads for list endpoints.
- Use `cache: "no-store"` patterns where fresh operational data is required.

Route handlers should not:

- Contain complex SQL composition.
- Implement multi-step business workflow logic inline.
- Send notification emails directly when an event/logging path should be used.
- Duplicate shared permission, voiding, filtering, or activity-history logic.

---

## Repository and Service Standards

Repositories should centralize:

- `list` or list-equivalent queries.
- `getById` / detail queries.
- `create` logic.
- `update`, `replace`, or status/action update logic.
- `void` / `unvoid` logic where applicable.
- Filtering, sorting, pagination, and count queries.
- Sales order normalization where applicable.
- Timezone/shift-date derivation where applicable.
- Transaction-safe saves for header/line records.
- Activity-history hooks where the module supports record audit feeds.

Use safe parameterization for SQL values. Do not concatenate user input into SQL.

---

## TypeScript Standards

- Use strong types for API payloads, repository inputs, rows, filters, and responses.
- Keep types close to the module when module-specific.
- Move shared types into `lib/types` or repository shared files when reused.
- Avoid `any` unless handling unknown JSON or external data at a boundary.
- Normalize external values before passing them deeper into repositories.

---

## Naming Conventions

### Tables

Use lowercase `snake_case`:

```text
cmms_work_orders
recut_requests
production_entries
platform_tasks
notification_events
```

### Columns

Use lowercase `snake_case`:

```text
created_at
created_by
updated_at
updated_by
entry_ts
entry_date
shift_date
status
sales_order_base
sales_order_display
is_voided
```

### TypeScript

Use camelCase for application types and API JSON responses:

```ts
createdAt
updatedAt
entryTs
entryDate
shiftDate
salesOrderBase
salesOrderDisplay
isVoided
```

Repositories should map database `snake_case` columns to API/UI camelCase where appropriate.

---

## Authentication and Role-Based Security

All protected APIs should validate the authenticated user.

Common roles include:

- `ADMIN`
- `MANAGER`
- `SUPERVISOR`
- `USER`
- `WAREHOUSE`
- `TECH`
- `PURCHASING`
- `SALES`
- `CUSTOMER SERVICE`

Standards:

- Enforce permissions at the API level.
- Reflect permissions in UI navigation/actions.
- Do not rely on hidden buttons as the only security layer.
- Keep role lists centralized or reusable where practical.
- Use module-specific access rules when a module requires narrower permissions.

---

## UI and Styling Standards

Use shared global CSS and reusable components.

Preferred classes/patterns:

- `page-shell`, `page-shell-wide`, `page-shell-table`
- `page-header`, `page-title`, `page-subtitle`
- `card`, `section-card`, `panel`, `muted-box`
- `btn`, `btn-primary`, `btn-secondary`, `btn-danger`
- `badge`, `badge-success`, `badge-warning`, `badge-danger`, `badge-brand-blue`
- `input`, `select`, `textarea`, `field-label`, `field-error`
- `alert`, `alert-success`, `alert-warning`, `alert-danger`, `alert-info`

Guidelines:

- Blue is the standard primary action color.
- Red is reserved for destructive actions.
- Avoid one-off inline styling when a global class exists.
- Keep forms visually consistent across modules.
- Use consistent error, loading, and empty states.

---

## DataTable Standard

Use the shared `DataTable` component for list pages unless there is a strong reason not to.

List pages should support, as applicable:

- Server-side pagination.
- Sorting.
- Column filters.
- Text contains filters for large option sets.
- Dropdown filters only for small controlled sets.
- CSV export.
- Row actions for view/edit/print/void where applicable.
- Row highlighting via shared classes.
- Global in-view search when useful.

For large data sets, do not load all rows into the browser.

---

## Forms and Validation

Forms should:

- Group fields into logical sections.
- Validate required fields before submit.
- Show clear field-level errors.
- Keep save/cancel actions consistent.
- Disable edit actions for voided records.
- Preserve user-entered values after validation errors.
- Avoid manual free-text entry when a controlled lookup must be selected.

---

## Timezone and Date Standards

Use `America/Chicago` for operational dates and shifts.

Production modules should consistently use:

```text
entry_ts
entry_date
shift_date
shift
```

Embroidery-style shift rules:

- Day: 06:00-17:59.
- Night: otherwise.
- Entries from 00:00-05:59 roll back to the previous `shift_date`.

---

## Sales Order Standards

Where applicable, normalize sales order values:

```text
sales_order_display  # UI/user-facing value
sales_order_base     # normalized first 7 digits/base order value
```

Use display values in the UI and base values for cross-module linking/reporting where appropriate.

---

## Voiding Standards

Do not physically delete business records that need audit history.

Use:

```text
is_voided
voided_at
voided_by
void_reason
```

Rules:

- Exclude voided records from normal lists, search, dashboards, reports, and exports by default.
- Prevent edits to voided records.
- Require confirmation before voiding.
- Use destructive styling for void actions.
- Log void/unvoid actions in activity history where available.

---

## Platform Service Standards

Before adding a module-specific feature, check whether it should use or extend a shared service:

- Activity History
- Comments
- Attachments
- Voiding
- Master Data
- Tasks & Assignments
- Task Events
- Notifications
- Approvals
- Revisions / Versioning
- Document Expiration / Renewal
- Integration Health
- KPI Registry

If a capability will be reused by more than one module, prefer a platform service.

---

## Notification and Task Standards

Build notifications in this order:

1. User notification fields and preferences.
2. Shared task records.
3. Task event history.
4. Notification event logging.
5. Email and future in-app delivery.

Avoid sending emails directly from scattered module routes. Prefer event-driven notification records with central recipient resolution and delivery logging.

Future assignment fields should use `public.users.id` as the stable key where practical, while preserving display names/legacy text fields during compatibility transitions.

---

## Reporting Standards

Development should preserve reporting quality:

- Use consistent date and shift fields.
- Exclude voided records by default.
- Capture structured values instead of only notes/free text.
- Use stable IDs for users, assignments, and lookup entities where possible.
- Keep status values consistent.
- Design with exports and dashboards in mind.
- Update the KPI registry/data dictionary as reporting definitions mature.

---

## Change Safety

When adding or changing platform foundations:

- Prefer additive schema changes.
- Keep existing users and login behavior working.
- Avoid disruptive rewrites of working modules.
- Preserve old display behavior while introducing stable IDs or normalized fields.
- Use phased rollout for authentication, notifications, tasks, and workflow changes.
- Provide SQL migrations and drop-in files rather than direct repo changes unless explicitly asked.
