-- 009_cmms_work_orders.sql
CREATE SCHEMA IF NOT EXISTS cmms;

-- Lookup tables
CREATE TABLE IF NOT EXISTS cmms.departments (
  id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cmms.assets (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id SMALLINT NOT NULL REFERENCES cmms.departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  UNIQUE (department_id, name)
);

CREATE TABLE IF NOT EXISTS cmms.priorities (
  id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cmms.issue_catalog (
  id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cmms.wo_types (
  id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cmms.statuses (
  id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cmms.techs (
  id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Work orders
CREATE TABLE IF NOT EXISTS cmms.work_orders (
  work_order_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  requested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by_user_id TEXT NOT NULL,
  requested_by_name    TEXT NOT NULL,

  department_id        SMALLINT NOT NULL REFERENCES cmms.departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  asset_id             INTEGER NOT NULL REFERENCES cmms.assets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  priority_id          SMALLINT NOT NULL REFERENCES cmms.priorities(id) ON UPDATE CASCADE ON DELETE RESTRICT,

  operator_initials    TEXT,

  type_id              SMALLINT NOT NULL REFERENCES cmms.wo_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  tech_id              SMALLINT REFERENCES cmms.techs(id) ON UPDATE CASCADE ON DELETE SET NULL,
  common_issue_id      SMALLINT NOT NULL REFERENCES cmms.issue_catalog(id) ON UPDATE CASCADE ON DELETE RESTRICT,

  issue_dialogue       TEXT NOT NULL,

  status_id            SMALLINT NOT NULL REFERENCES cmms.statuses(id) ON UPDATE CASCADE ON DELETE RESTRICT,

  -- tech-side fields (future landing page will manage these)
  resolution           TEXT,
  down_time_recorded   TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmms_wo_requested_at ON cmms.work_orders (requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmms_wo_department   ON cmms.work_orders (department_id);
CREATE INDEX IF NOT EXISTS idx_cmms_wo_asset        ON cmms.work_orders (asset_id);
CREATE INDEX IF NOT EXISTS idx_cmms_wo_status       ON cmms.work_orders (status_id);
CREATE INDEX IF NOT EXISTS idx_cmms_wo_priority     ON cmms.work_orders (priority_id);
CREATE INDEX IF NOT EXISTS idx_cmms_wo_type         ON cmms.work_orders (type_id);
CREATE INDEX IF NOT EXISTS idx_cmms_wo_tech         ON cmms.work_orders (tech_id);