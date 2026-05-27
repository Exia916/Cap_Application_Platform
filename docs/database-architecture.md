# Database Architecture

**Last updated:** 2026-05-22

CAP uses PostgreSQL as the primary operational database. Database design should support transactional module workflows, shared platform services, auditability, reporting, and future integrations.

---

## Infrastructure

| Area | Standard |
| --- | --- |
| Database | PostgreSQL |
| Hosting | Internal/on-prem Windows VM, with future cloud migration possible |
| Application Layer | Next.js hosted on Vercel |
| File Storage | Amazon S3 for file objects; PostgreSQL for file metadata |
| Access Pattern | Direct SQL through repository/service layer; no ORM |

---

## Design Principles

Database design should follow these principles:

- Use normalized relational tables for operational records.
- Keep module data structured and reporting-ready.
- Use consistent naming conventions.
- Preserve audit history.
- Use soft-removal/voiding instead of destructive deletes where business records need traceability.
- Prefer reusable platform tables for shared services.
- Support module-specific fields without breaking shared architecture.
- Keep future reporting, Metabase, and cross-module analytics in mind.

---

## Naming Conventions

### Tables

Use lowercase `snake_case` table names.

Preferred patterns:

```text
<module>_<entity>
<platform_service>_<entity>
<module>_<entity>_lines
<module>_<entity>_events
```

Examples:

```text
recut_requests
knit_production_submissions
knit_production_lines
activity_history
comments
attachments
platform_tasks
platform_task_events
notification_events
```

### Columns

Use lowercase `snake_case`.

Examples:

```text
created_at
created_by
updated_at
updated_by
entry_ts
entry_date
shift_date
sales_order_base
sales_order_display
is_voided
voided_at
voided_by
void_reason
```

---

## Core Entity Types

### Operational Records

Examples:

- Production entries/submissions
- Recut requests
- CMMS work orders
- Workflow requests
- Inbound shipment records
- Quote configuration records
- Product specs/BOM records
- Compliance records

### Reference / Master Data

Examples:

- Departments
- Roles
- Shifts
- Machines
- Locations
- CMMS assets
- Recut reasons
- Embroidery type/location data
- Vendors/factories
- Compliance categories
- Document types

Reference data should prefer registry-driven admin patterns where practical.

### Platform Service Records

Examples:

- `activity_history`
- `comments`
- `attachments`
- `platform_tasks`
- `platform_task_events`
- `notification_events`
- `approval_requests`
- `record_revisions`
- `document_expirations`
- `integration_health_events`
- `kpi_definitions`

Shared platform records should use generic linking fields such as `entity_type`, `entity_id`, `module`, and/or source-record identifiers where applicable.

---

## Standard Audit Fields

Most operational and platform tables should include:

```sql
created_at timestamp not null default now()
created_by text null
updated_at timestamp null
updated_by text null
```

When stable user references are available, future assignment/audit fields should move toward `public.users.id` as the stable key while preserving display fields where needed for compatibility.

---

## Voiding Standard

For operational records that should be removed from normal use without losing audit history, use the platform voiding pattern:

```sql
is_voided boolean not null default false
voided_at timestamp null
voided_by text null
void_reason text null
```

Standard behavior:

- Normal lists exclude voided records by default.
- Standard searches exclude voided records by default.
- Dashboards, exports, and reports exclude voided records by default.
- Voided records remain stored for audit purposes.
- Voided records should not be editable.
- Admin users may receive an optional include/only voided view depending on module needs.

Avoid mixing `deleted_at` soft-deletes with the CAP voiding model for business records unless there is a specific technical reason.

---

## Timezone and Shift-Date Standards

CAP should consistently use `America/Chicago` for user-facing operational dates.

Common production timestamp/date fields:

```text
entry_ts      # source timestamp
entry_date    # local date derived in America/Chicago
shift_date    # reporting shift date where applicable
shift         # Day/Night or configured shift label where applicable
```

Embroidery-style shift logic:

- Day shift: 06:00-17:59.
- Night shift: 18:00-05:59.
- Entries between 00:00 and 05:59 belong to the prior `shift_date`.

For reporting, prefer `shift_date` when the question is shift-based rather than calendar-entry based.

---

## Sales Order Normalization

Where sales orders are stored or linked, use normalized display/base fields when applicable:

```text
sales_order_display  # the full value users see/type/select
sales_order_base     # first 7 digits / normalized base order number
```

This supports:

- SBT lookup compatibility.
- Cross-module linking.
- Reporting by base sales order.
- Searches where users type partial or decorated order values.
- Future auto-fill workflows.

---

## Attachments and S3 Metadata

Attachment files are stored in Amazon S3. PostgreSQL stores metadata and the S3 object key.

Attachment metadata should generally include:

```text
id
entity_type
entity_id
original_file_name
s3_key
mime_type
file_size_bytes
uploaded_by
uploaded_by_name
attachment_comment
created_at
updated_at
```

S3 objects should remain private. Access should be provided through controlled API routes and/or presigned URLs.

---

## User Notification Plumbing

The user table should support notification foundations without disrupting current login behavior.

Recommended user fields:

```text
email
email_notifications_enabled
in_app_notifications_enabled
manager_user_id        # optional future escalation/routing
last_login_at          # optional visibility/audit field
updated_at
updated_by
```

Guidelines:

- Keep `email` nullable unless leadership decides otherwise.
- Do not require email for login unless a future authentication project explicitly changes that.
- Store preferences separately from delivery logs.
- Use stable user IDs for future assignment fields when practical.

---

## Tasks, Notifications, and Events

The task foundation should use shared platform tables instead of module-specific assignment tables wherever possible.

Recommended conceptual entities:

- `platform_tasks`
- `platform_task_events`
- `notification_events`
- `notification_deliveries` or delivery details on `notification_events`

Task records should link back to source records using fields such as:

```text
source_module
source_entity_type
source_entity_id
source_record_label
assigned_user_id
assigned_role
assigned_department
status
due_at
completed_at
completed_by
```

Notification records should be generated from events rather than hardcoded directly into module route handlers.

---

## Approval, Revision, and Document Expiration Foundations

These services should be reusable across product specs, BOMs, compliance, quotes, workflow, and document-heavy modules.

Conceptual entities:

- Approval requests and approval steps.
- Record revisions with draft/active/retired states.
- Document expiration records with owner, expiration date, renewal lead time, and renewal task linkage.

These foundations should preserve audit history and integrate with tasks, notifications, comments, and attachments.

---

## Integration Health and KPI Governance

CAP should eventually track integration and reporting metadata in structured tables.

Recommended future concepts:

- Integration status / last successful call / last error / stale data warnings.
- KPI definitions with formula, owner, source tables, date/shift logic, voiding logic, refresh expectations, and report usage.
- Data dictionary entries for key fields and reporting dimensions.

---

## Migration Standards

Database changes should be handled through migration files.

Migration guidelines:

- Use additive changes when possible.
- Avoid breaking current users or existing forms.
- Backfill data safely and explicitly.
- Add indexes for high-use filters/searches.
- Use transactions for multi-step schema/data changes when practical.
- Document assumptions and rollback considerations for high-risk changes.

---

## Query and Indexing Standards

Repositories should use parameterized SQL and safe dynamic query building.

For large list pages:

- Use server-side filtering and pagination.
- Return total counts separately or in a paged result shape.
- Avoid sending large unbounded result sets to the browser.
- Use indexes for frequently filtered columns.
- Consider `pg_trgm`/GIN indexes for heavy partial search fields when needed.
- Keep list queries aligned with DataTable filters and sort keys.
