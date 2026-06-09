-- 3DTSI Labor Intelligence Platform - Core Schema
-- Migration 0001: identity, projects, catalog, work tracking, intelligence

PRAGMA defer_foreign_keys = true;

-- ============================================================
-- IDENTITY & SECURITY
-- ============================================================

CREATE TABLE roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  -- JSON array of permission keys; "*" grants everything
  permissions TEXT NOT NULL DEFAULT '[]',
  is_system   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT NOT NULL,
  password_salt   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role_id         INTEGER NOT NULL REFERENCES roles(id),
  office_location TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  active          INTEGER NOT NULL DEFAULT 1,
  mfa_secret      TEXT,
  mfa_enabled     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_role ON users(role_id);

CREATE TABLE auth_sessions (
  id          TEXT PRIMARY KEY,              -- session token id (jti)
  user_id     INTEGER NOT NULL REFERENCES users(id),
  ip_address  TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT '',
  device      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE login_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  email       TEXT NOT NULL,
  success     INTEGER NOT NULL,
  mfa_used    INTEGER NOT NULL DEFAULT 0,
  ip_address  TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT '',
  device      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_history_user ON login_history(user_id);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,                  -- e.g. session.start, project.create
  entity     TEXT NOT NULL DEFAULT '',
  entity_id  TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '{}',     -- JSON
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- ============================================================
-- CUSTOMERS & PROJECTS
-- ============================================================

CREATE TABLE customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  market_segment TEXT NOT NULL DEFAULT 'Commercial',
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  project_number     TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  customer_id        INTEGER NOT NULL REFERENCES customers(id),
  site_address       TEXT NOT NULL DEFAULT '',
  market_segment     TEXT NOT NULL DEFAULT 'Commercial',
  project_type       TEXT NOT NULL DEFAULT 'Installation',
  office_location    TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'active',   -- active | on_hold | complete | cancelled
  labor_budget_hours REAL NOT NULL DEFAULT 0,
  qr_token           TEXT NOT NULL UNIQUE,             -- embedded in project QR code
  pm_user_id         INTEGER REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================================
-- CATALOG: SYSTEMS / DEVICES / TASK TYPES
-- ============================================================

CREATE TABLE systems (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE devices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  system_id     INTEGER NOT NULL REFERENCES systems(id),
  name          TEXT NOT NULL,
  unit          TEXT NOT NULL DEFAULT 'each',   -- each | feet
  -- current estimating-database labor rate (man-hours per unit);
  -- the intelligence engine compares actuals against this
  estimate_hours_per_unit REAL NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(system_id, name)
);
CREATE INDEX idx_devices_system ON devices(system_id);

CREATE TABLE task_types (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE cable_types (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- WORK TRACKING (the data the intelligence engine learns from)
-- ============================================================

CREATE TABLE work_sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  mode             TEXT NOT NULL,             -- device | cable
  project_id       INTEGER NOT NULL REFERENCES projects(id),
  system_id        INTEGER REFERENCES systems(id),
  device_id        INTEGER REFERENCES devices(id),
  cable_type_id    INTEGER REFERENCES cable_types(id),
  task_type_id     INTEGER NOT NULL REFERENCES task_types(id),
  crew_size        INTEGER NOT NULL DEFAULT 1,   -- technicians on this task
  created_by       INTEGER NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'running', -- running | paused | completed | cancelled
  started_at       TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at         TEXT,
  active_seconds   INTEGER NOT NULL DEFAULT 0,  -- computed from events at stop
  quantity         REAL,                        -- devices installed OR feet pulled
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ws_project ON work_sessions(project_id);
CREATE INDEX idx_ws_device ON work_sessions(device_id);
CREATE INDEX idx_ws_status ON work_sessions(status);
CREATE INDEX idx_ws_created_by ON work_sessions(created_by);

-- start / pause / resume / stop timeline (timer source of truth)
CREATE TABLE session_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES work_sessions(id),
  event      TEXT NOT NULL,                  -- start | pause | resume | stop
  at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_session_events_session ON session_events(session_id);

-- technicians attached to a session (crew membership)
CREATE TABLE session_technicians (
  session_id INTEGER NOT NULL REFERENCES work_sessions(id),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (session_id, user_id)
);

-- cable reels for cable-pulling sessions
CREATE TABLE cable_reels (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       INTEGER NOT NULL REFERENCES work_sessions(id),
  reel_number      INTEGER NOT NULL,
  starting_length  REAL NOT NULL,
  remaining_length REAL,
  UNIQUE(session_id, reel_number)
);

-- finalized production metrics, written once when a session completes;
-- this table IS the labor intelligence database
CREATE TABLE labor_metrics (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id         INTEGER NOT NULL UNIQUE REFERENCES work_sessions(id),
  project_id         INTEGER NOT NULL REFERENCES projects(id),
  customer_id        INTEGER NOT NULL REFERENCES customers(id),
  system_id          INTEGER REFERENCES systems(id),
  device_id          INTEGER REFERENCES devices(id),
  cable_type_id      INTEGER REFERENCES cable_types(id),
  task_type_id       INTEGER NOT NULL REFERENCES task_types(id),
  market_segment     TEXT NOT NULL,
  office_location    TEXT NOT NULL DEFAULT '',
  project_type       TEXT NOT NULL DEFAULT '',
  crew_size          INTEGER NOT NULL,
  unit               TEXT NOT NULL,             -- each | feet
  quantity           REAL NOT NULL,
  total_hours        REAL NOT NULL,             -- elapsed clock hours
  man_hours          REAL NOT NULL,             -- total_hours * crew_size
  hours_per_unit     REAL NOT NULL,             -- man_hours / quantity
  units_per_hour     REAL NOT NULL,             -- quantity / total_hours
  units_per_man_hour REAL NOT NULL,             -- quantity / man_hours
  estimate_hours_per_unit REAL NOT NULL DEFAULT 0, -- estimating rate at time of work
  work_date          TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lm_device ON labor_metrics(device_id);
CREATE INDEX idx_lm_cable ON labor_metrics(cable_type_id);
CREATE INDEX idx_lm_project ON labor_metrics(project_id);
CREATE INDEX idx_lm_customer ON labor_metrics(customer_id);
CREATE INDEX idx_lm_market ON labor_metrics(market_segment);
CREATE INDEX idx_lm_date ON labor_metrics(work_date);

PRAGMA defer_foreign_keys = false;
