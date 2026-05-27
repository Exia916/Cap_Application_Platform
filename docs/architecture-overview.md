# Platform Architecture Overview

**Last updated:** 2026-05-22

The Cap Applications Platform is built as a layered internal operations platform. It supports current production, maintenance, recut, workflow, playbook, and admin capabilities while leaving room for future tasks, notifications, approvals, compliance, logistics, reporting, and E.D.I. / Omni-Tool alignment.

---

## Architecture Layers

```text
Users
  ↓
Next.js Web Application / UI
  ↓
Operational Modules
  ↓
Shared Platform Services
  ↓
Integration Layer
  ↓
Repository / Service Layer
  ↓
PostgreSQL Database
  ↓
Reporting / Analytics Layer
```

---

## Infrastructure Model

| Area | Standard |
| --- | --- |
| Application Hosting | Vercel |
| Frontend | Next.js App Router, React, TypeScript |
| API Runtime | Next.js API routes / Vercel serverless functions |
| Database | PostgreSQL hosted internally/on-prem |
| File Storage | Amazon S3 |
| Reporting | CAP dashboards and future/optional Metabase layer |
| Timezone | America/Chicago |

CAP uses a hybrid model: the application/API layer runs in Vercel while the operational PostgreSQL database remains internally hosted.

---

## Operational Modules

Operational modules represent business functions. Current and near-term modules include:

- Production
  - Embroidery
  - QC
  - Emblem
  - Laser
  - Knit Production
  - Knit QC
  - Sample Embroidery
  - Work Sessions
- Recuts
- Maintenance / CMMS
- Playbooks
- CAP Workflow / Design Workflow
- Admin / Users / Roles / Master Data
- Global Search
- Inbound Shipments (planned)
- Overseas Quote Configurators (planned)
- Product Specs / BOM (planned)
- General Compliance (planned)

Each module may have its own data model and workflow, but it should use the same platform structure and shared services wherever possible.

---

## Standard Module Architecture

A standard module should include:

```text
app/<module>/page.tsx                  # list page
app/<module>/add or new/page.tsx       # create page when applicable
app/<module>/[id]/page.tsx             # record/detail page
app/<module>/[id]/edit/page.tsx        # edit page when applicable

app/api/<module>/route.ts              # list/create route
app/api/<module>/[id]/route.ts         # get/update route
app/api/<module>/[id]/<action>/route.ts # optional action route

lib/repositories/<module>Repo.ts       # data access and query composition
components/<module>/...                # module-specific UI when needed
components/platform/...                # shared record services
```

API routes should remain thin and delegate database access and business logic to repositories/services.

---

## Shared Platform Services

Shared services are reusable capabilities that modules should reference instead of rebuilding.

Current core services:

- Activity History
- Comments / Notes
- Attachments / S3
- Voiding
- Registry-driven Master Data
- Global Search
- Work Sessions

Planned platform foundations:

- User Notification Plumbing
- CAP Tasks & Assignments
- Task Event / Assignment History
- Notification Event Logging
- In-App Notification Center
- Shared Approval Framework
- Record Revision / Versioning
- Document Expiration / Renewal
- Integration Health Monitoring
- Data Dictionary / KPI Registry
- Vendor / Factory Master Data
- Platform Configuration Center

---

## Data Access Layer

The data access layer uses repositories and services to isolate SQL and business rules from UI components and API handlers.

Repository responsibilities include:

- List queries with filtering, sorting, pagination, and count queries.
- Detail retrieval.
- Create/update/replace actions.
- Void/unvoid actions where applicable.
- Safe dynamic SQL with parameterized values.
- Shared filtering helpers.
- Sales order normalization.
- Shift/date derivation.
- Activity history hooks.
- Transaction-safe writes when saving headers with line records.

---

## Integration Layer

The integration layer should isolate external system access from UI and route handlers.

Current or planned integrations include:

- SBT / ERP sales order lookup and auto-fill.
- Wilcom/design lookup and workflow data.
- B-Net / machine telemetry.
- Paycom or labor data if labor/productivity reporting expands.
- Email provider for notifications.
- Amazon S3 for file storage.
- Metabase or future analytics tooling.

Integration logic should live in `lib/integrations/*` or service modules, not directly in UI components.

---

## Reporting / Analytics Layer

Reporting should be treated as a platform layer, not only a module feature.

Reporting architecture should support:

- CAP dashboards.
- DataTable CSV exports.
- Manager views.
- Metabase/internal analytics.
- KPI registry and governed formulas.
- Consistent date, shift, sales order, and voided-record rules.
- Future cross-system reporting across CAP, SBT, Wilcom, B-Net, and other data sources.

---

## Platform Governance Direction

As CAP expands, new work should be classified as one of the following:

- **New module**: A new business area such as inbound shipments or compliance.
- **Enhancement**: A change to an existing module.
- **Platform service**: Shared plumbing such as tasks, notifications, approvals, revisions, or KPI definitions.
- **Integration**: External system connection or sync.
- **Reporting layer**: Dashboards, exports, metrics, or analytics definitions.

When a capability could apply to multiple modules, build it as a platform service unless there is a clear reason not to.
