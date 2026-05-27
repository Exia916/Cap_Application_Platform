# Cap Applications Platform

**Last updated:** 2026-05-22  
**Purpose:** Current project baseline for architecture, module design, platform services, reporting, and development standards.

The Cap Applications Platform (CAP) is an internal manufacturing and operations platform used to support production tracking, maintenance/CMMS, recuts, work sessions, playbooks, workflow, reporting, and future business-process automation.

CAP is no longer only a collection of department modules. It should be treated as a growing platform with shared services that support multiple operational areas.

---

## Core Objectives

CAP exists to:

- Provide a unified internal operations platform.
- Replace manual spreadsheets, disconnected tools, and one-off process trackers.
- Improve operational visibility across departments.
- Standardize workflows, data capture, approvals, tasks, and reporting.
- Create clean operational data for dashboards, Metabase, analytics, and future AI-assisted work.
- Reuse platform services instead of rebuilding similar functionality in every module.

---

## Technology Stack

| Layer | Standard |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS with shared global CSS tokens/classes |
| Backend | Next.js API routes hosted on Vercel |
| Data Access | Repository/service pattern using direct SQL |
| Database | PostgreSQL hosted internally/on-prem |
| File Storage | Amazon S3 for attachments and documents |
| Reporting | CAP dashboards and future/optional Metabase layer |
| Timezone | America/Chicago |

---

## Current Operating Baseline

The following areas are part of the current CAP foundation and should guide future module work:

- Embroidery Daily Production
- QC Daily Production
- Emblem Production
- Laser Production
- Knit Production
- Knit QC
- Sample Embroidery
- Production Work Sessions
- Recuts
- Maintenance / CMMS
- Playbooks
- Admin / Users / Roles
- Registry-driven Master Data
- Global Search
- CAP Workflow / Design Workflow
- Shared activity history, comments, attachments, and voiding

Future modules should build on these patterns instead of introducing isolated designs.

---

## Platform Design Philosophy

CAP should follow these principles:

1. **Shared module pattern**  
   New business areas should use the same general structure: UI pages, API routes, repository/service layer, database tables, shared components, platform services, permissions, and reporting-ready data.

2. **Repository and service layers first**  
   API routes should stay thin. Database access and business rules belong in repositories or services, not directly inside route handlers or UI components.

3. **Reusable services over one-off features**  
   Comments, attachments, activity history, voiding, tasks, notifications, approvals, revisions, document expiration, and reporting definitions should be shared platform capabilities.

4. **Consistent UI and global styling**  
   Use shared components, global CSS tokens, page shells, cards, buttons, badges, forms, alerts, and the shared `DataTable` component.

5. **Reporting-ready data**  
   Modules should capture data in a structured way that supports dashboards, exports, KPI definitions, shift reporting, and cross-module analysis.

6. **Auditability by default**  
   Creates, updates, comments, attachments, status changes, voiding, task actions, notifications, approvals, and key workflow changes should be traceable.

---

## Shared Platform Services

Current and planned platform services include:

| Service | Status Direction | Standard Use |
| --- | --- | --- |
| Activity History | In progress | Record-level audit feed for create/update/status/action events. |
| Comments / Notes | In progress | Reusable record-level notes and investigation context. |
| Attachments / S3 | In progress | S3-backed file uploads, previews, downloads, comments, and metadata. |
| Voiding | In progress | Standard soft removal using `is_voided`, `voided_at`, `voided_by`, and `void_reason`. |
| Master Data | In progress | Registry-driven admin lists and dropdown data. |
| User Notification Plumbing | Planning | User email, notification preferences, manager routing, and audit-ready user updates. |
| CAP Tasks & Assignments | Planning | Shared task model for assigned work linked to module records. |
| Task Events / Assignment History | Planning | Lifecycle events for assigned work. |
| Notification Event Logging | Planning | Central notification event and delivery tracking. |
| In-App Notification Center | Open | Future notification inbox inside CAP. |
| Shared Approval Framework | Open | Reusable approve/reject/comment/history pattern. |
| Record Revision / Versioning | Open | Draft/active/retired/effective-date version model. |
| Document Expiration / Renewal | Open | Expiring documents, owners, renewal tasks, and notification hooks. |
| Integration Health | Open | Last success/error/stale data/retry visibility for integrations. |
| Data Dictionary / KPI Registry | Open | Governed metric definitions and reporting ownership. |
| Vendor / Factory Master Data | Open | Shared supplier/factory records for logistics, quotes, specs, and compliance. |
| Platform Configuration Center | Exploratory | Future admin area for templates, rules, categories, triggers, and settings. |

---

## Current Build Sequence

The current roadmap should keep platform plumbing ahead of broad automation:

1. **User Notification Plumbing**  
   Add or confirm user email, email notification preference, in-app notification preference, optional manager routing, last-login visibility, and update audit fields.

2. **CAP Tasks & Assignments**  
   Build shared task records and task events. Start with CAP Workflow Digitizer/Designer assignments as the first practical use case.

3. **Task Queues**  
   Add My Work and manager task queues so users can see work before email notification logic is expanded.

4. **Workflow Notifications**  
   Drive notifications from task/workflow events and log notification delivery centrally. Avoid scattering direct email logic across module routes.

5. **Reusable Approval / Revision / Expiration Services**  
   Use these foundations for product specs, BOMs, compliance, overseas quotes, inbound shipments, and workflow transitions.

---

## Future Workstreams

Named future workstreams include:

- Inbound Shipment Tracking
- Overseas Custom Quote Calculator / Configurator
- Productivity Reporting
- Product Specs / BOM / Item Compliance Documents
- General Compliance
- B-Net / machine telemetry integration
- Metabase / analytics expansion
- Platform Configuration Center
- Mobile / tablet / scanner-ready workflows
- Future E.D.I. / Omni-Tool alignment

These should reuse CAP services instead of creating separate feature-specific versions of comments, attachments, approvals, notifications, tasks, or reporting logic.

---

## Repository Guidance

When working with the GitHub repository as a reference:

- Do not make direct changes unless explicitly requested.
- Use the repository to match existing file structure and implementation patterns.
- Provide drop-in files, migrations, or snippets in chat when requested.
- Preserve current login behavior and existing users when changing authentication or user-related schema.
- Prioritize compatibility and incremental rollout over large disruptive rewrites.

---

## Core Standards Summary

All future CAP work should follow these defaults:

- Next.js App Router with TypeScript.
- Thin API routes.
- Repository/service layer for database and business logic.
- PostgreSQL with safe parameterized SQL.
- Shared `DataTable` for list pages.
- Global CSS tokens/classes for layout, cards, buttons, badges, alerts, forms, and tables.
- Role checks enforced at the API level and reflected in UI actions/navigation.
- `America/Chicago` timezone handling.
- `entry_ts`, `entry_date`, and `shift_date` where applicable.
- Embroidery shift logic: Day shift is 06:00-17:59; Night shift is otherwise, with shift date rolling back for entries after midnight before 06:00.
- Sales order normalization using `sales_order_display` and `sales_order_base` where applicable.
- Voiding support where records must be removed from normal operational use without deleting audit history.
- Read-only behavior for voided records.
- Reporting-ready data design from the start.
