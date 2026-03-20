# Platform Services

Platform services provide reusable functionality used across all modules.

Modules should reference these services rather than building custom implementations.

## Activity History

Tracks user actions within records.

Examples:

- Record created
- Status changes
- Attachments added
- Comments added
- Record updated

Benefits:

- audit trail
- troubleshooting
- operational transparency

## Comments / Notes

Allows users to add contextual notes to records.

Typical usage:

- technician notes
- supervisor instructions
- issue tracking
- investigation comments

Features:

- threaded comments
- edit history
- soft deletion

## Attachments

Allows files to be associated with records.

File storage is handled through Amazon S3.

Benefits of S3:

- highly scalable storage
- secure object storage
- durable long-term file retention
- CDN integration possible

Typical attachments:

- photos
- inspection reports
- documentation
- work instructions

Features:

- drag and drop uploads
- file validation
- activity logging
- file size restrictions

## Notifications (Future)

System alerts based on events.

Examples:

- new maintenance ticket
- production issue
- quality alert

## Workflow Engine (Future)

Defines process flows across departments.

Examples:

Sales → Art → Production → QC → Shipping

## Record Lifecycle (Void / Soft Delete)

Provides a standardized way to remove records from operational use without deleting them from the database.

This service ensures consistency across all modules for handling invalid, duplicate, or cancelled entries.

Purpose

preserve full audit history

prevent permanent data loss

maintain reporting accuracy

allow controlled administrative recovery

Core Behavior

When a record is voided:

it is hidden from all standard list views

it is excluded from global search

it is excluded from dashboards and KPI calculations

it is excluded from reports and exports by default

it remains stored in the database for audit purposes

Standard Fields

All modules should implement the following fields:

is_voided boolean not null default false

voided_at timestamp null

voided_by text null

void_reason text null

Service Responsibilities

apply consistent filtering (is_voided = false) across:

list pages

search queries

reporting datasets

provide reusable repository/query helpers

enforce role-based permissions

log all void/unvoid actions in Activity History

support optional “include voided” mode for admin users

Typical Use Cases

incorrect data entry

duplicate records

cancelled orders or requests

test or training entries

UI / UX Guidelines

provide a "Void Entry" action on record pages

require confirmation before voiding

optionally require a reason

use a clear destructive action style (red button)

redirect users back to the list page after action

Permissions

Recommended access model:

Admin: void and unvoid

Manager / Supervisor: void

Standard users: restricted or limited

Activity Tracking

All void actions should generate Activity History entries:

event type: voided

include user, timestamp, and reason

capture before/after state

Future Enhancements

admin “view voided records” filter

restore / unvoid functionality

reporting toggle to include/exclude voided data