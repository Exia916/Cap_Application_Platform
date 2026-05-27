# UI Standards

**Last updated:** 2026-05-22

CAP should present a consistent user experience across modules. Users should feel like they are working inside one platform, not separate applications.

---

## UI Principles

- Use existing global CSS classes and design tokens before adding new styles.
- Use shared components wherever practical.
- Keep layouts consistent across modules.
- Make role-based actions visible only when users can perform them.
- Preserve API-level security even when UI actions are hidden.
- Design pages for operational speed and clarity.
- Keep reporting/export needs in mind on list pages.
- Support responsive, tablet, and future scanner-friendly workflows where practical.

---

## Global Styling

Shared styling should live in `globals.css`.

Common classes/patterns:

```text
page-shell
page-shell-wide
page-shell-table
page-header
page-title
page-subtitle
section-stack
card
card-lg
section-card
panel
muted-box
btn
btn-primary
btn-secondary
btn-danger
btn-sm
btn-lg
input
select
textarea
field-label
field-error
alert
badge
```

Avoid creating one-off inline styles when a global class or shared pattern exists.

---

## Brand and Action Colors

CAP uses global design tokens.

Action color rules:

- **Blue** = primary action.
- **White/neutral** = secondary action.
- **Red** = destructive action such as delete, void, deactivate, or reject when destructive.

Do not use red for normal primary actions.

---

## Navigation Standards

Navigation should be grouped by business function.

Current/future groups may include:

- Home / Dashboard.
- Workflow.
- Production.
- Recuts.
- Maintenance.
- Manager.
- Admin.
- Playbooks.
- My Account.
- My Work / Tasks.
- Notifications.
- Logistics / Overseas.
- Compliance / Product Data.

Navigation should reflect role permissions and should avoid showing users areas they cannot access.

---

## Page Layout Standards

Standard page layout:

```tsx
<main className="page-shell">
  <div className="page-header">
    <div>
      <h1 className="page-title">Page Title</h1>
      <p className="page-subtitle">Short purpose/context.</p>
    </div>
    <div>{/* primary actions */}</div>
  </div>

  <div className="section-stack">
    {/* cards, forms, tables, panels */}
  </div>
</main>
```

Use `page-shell-table` or `page-shell-wide` for wide operational list pages.

---

## DataTable UI Standard

The shared `DataTable` is the default for list pages.

Expected list behavior:

- Sorting.
- Filtering.
- Server-side pagination for large data sets.
- Page size selection.
- CSV export where useful.
- Row actions.
- Row hover.
- Optional row click/double-click.
- Loading, error, and empty states.
- Optional row highlighting.

Filter rules:

- Use text contains filters for columns with large or growing value sets.
- Use dropdown filters for small controlled values such as yes/no, status groups, or bins when appropriate.
- Date ranges should use date inputs.

---

## Record View Standard

Record views should have a clear header, metadata, action buttons, and shared record support.

Recommended structure:

```text
Record Header
  - Title / ID
  - Status badge
  - Subtitle / key reference
  - Actions

Record Body
  - Summary details
  - Module-specific sections
  - Line-item/detail tables

Shared Panels
  - Attachments
  - Comments
  - Activity History
  - Tasks / Assignments where applicable
  - Approvals / Revisions / Document Expiration where applicable
```

Use the shared record layout classes where possible.

---

## Form UI Standard

Forms should be organized into clear sections.

Standards:

- Use `input`, `select`, and `textarea` classes.
- Use `field-label`, `field-help`, and `field-error` classes.
- Mark required fields consistently.
- Group related fields in cards/sections.
- Provide save/cancel actions in a consistent location.
- Use sticky action footers where helpful.
- Disable fields/actions while saving.
- Show clear validation messages.
- Prevent edits to voided records.

---

## Button Standards

Use shared button classes:

```text
btn btn-primary     # primary action
btn btn-secondary   # secondary action
btn btn-danger      # destructive action
btn btn-sm          # smaller button
btn btn-lg          # larger button
```

Examples:

- Save/Create/Apply = `btn btn-primary`.
- Cancel/Back/Open = `btn btn-secondary`.
- Void/Delete/Deactivate = `btn btn-danger`.

---

## Badge and Status Standards

Use badges for statuses and important flags.

Common classes:

```text
badge
badge-neutral
badge-success
badge-warning
badge-danger
badge-brand-blue
badge-brand-red
```

Guidelines:

- Keep status labels consistent across list and record views.
- Use destructive/danger styling for high-risk flags like Do Not Pull, voided, expired, failed, rejected, or overdue.
- Avoid creating custom colors unless the status map requires exact legacy parity.

---

## Attachments UI Standard

Attachments should use the shared platform attachment experience where applicable.

Expected features:

- Drag-and-drop upload.
- File list/table.
- Uploaded by / date metadata.
- File comments where supported.
- Preview where supported.
- Open/download/share behavior through controlled APIs.
- Clear upload/delete errors.
- Activity logging where available.

S3 files should not be made public.

---

## Comments and Activity UI Standards

Comments:

- Show user and timestamp.
- Use a simple add-comment form.
- Keep comments tied to the record.

Activity History:

- Show event message, user, timestamp, and event type.
- Collapse by default on dense pages when needed.
- Display before/after values for important changes where available.

---

## Task / My Work UI Direction

When the task foundation is added, task UI should support:

- My assigned tasks.
- Role/department tasks.
- Due today / overdue / open / completed filters.
- Linked record shortcuts.
- Manager reassignment path.
- CSV export for manager task lists.
- Badges for status, due/overdue, and priority if used.

Task UI should reuse DataTable and global styling rather than a custom visual system.

---

## Notification UI Direction

Future notification UI should support:

- In-app notification center.
- Read/unread state.
- Links back to source records/tasks.
- Notification type/status badges.
- User preferences in My Account.

Notification UI should be built on notification event records, not isolated module alerts.

---

## Mobile / Tablet / Scanner Readiness

Operational pages should be designed with future mobile/scanner use in mind.

Guidelines:

- Keep forms usable on tablets.
- Avoid tiny click targets for floor/warehouse workflows.
- Support scanner-friendly fields where barcode entry is expected.
- Keep critical actions reachable without excessive horizontal scrolling.
- Use responsive layouts for record pages and panels.

---

## Empty, Loading, and Error States

Every operational page should have clear states:

- Loading: show a simple loading message or visual indicator.
- Empty: explain that no records matched the filters or none exist yet.
- Error: show a clear, recoverable error message.
- Success: confirm key actions such as save, upload, void, or submit.

Use shared `alert` classes for visible messages.

---

## Accessibility and Usability

Basic standards:

- Use semantic buttons and links.
- Keep keyboard access in mind for forms and menus.
- Provide visible focus states.
- Use labels for inputs.
- Avoid relying only on color to communicate meaning.
- Keep status text visible inside badges.
- Ensure dialogs/modals have clear close/cancel paths.

---

## UI Build Checklist

Before completing a page, confirm:

- [ ] Uses global page shell/layout classes.
- [ ] Uses shared buttons/forms/badges/cards.
- [ ] Uses `DataTable` for list views where applicable.
- [ ] Has loading, error, and empty states.
- [ ] Hides actions the user cannot perform.
- [ ] API still enforces permissions.
- [ ] Handles voided/read-only state where applicable.
- [ ] Uses consistent date/status display.
- [ ] Supports export if the list is report-worthy.
- [ ] Works reasonably on narrower screens.
