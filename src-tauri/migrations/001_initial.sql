-- CNC Tool Converter — initial SQLite schema
--
-- Design principle: every record is stored as a JSON blob in `data`.
-- Scalar columns (id, indexed fields) exist purely for fast lookups.
-- All business logic runs in TypeScript; Rust/SQL is a thin storage layer.

-- ── Tools ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tools (
  id          TEXT    NOT NULL PRIMARY KEY,
  tool_number INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  data        TEXT    NOT NULL  -- full LibraryTool JSON
);

CREATE INDEX IF NOT EXISTS idx_tools_added_at    ON tools (added_at);
CREATE INDEX IF NOT EXISTS idx_tools_tool_number ON tools (tool_number);

-- ── Materials ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS materials (
  id         TEXT    NOT NULL PRIMARY KEY,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  data       TEXT    NOT NULL  -- full WorkMaterial JSON
);

CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials (created_at);

-- ── Holders ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS holders (
  id         TEXT    NOT NULL PRIMARY KEY,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  data       TEXT    NOT NULL  -- full ToolHolder JSON
);

CREATE INDEX IF NOT EXISTS idx_holders_created_at ON holders (created_at);

-- ── Templates ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS templates (
  id         TEXT    NOT NULL PRIMARY KEY,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  data       TEXT    NOT NULL  -- full ToolTemplate JSON
);

CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates (created_at);

-- ── Stock transactions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT    NOT NULL PRIMARY KEY,
  tool_id       TEXT    NOT NULL,
  timestamp     INTEGER NOT NULL,
  delta         INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason        TEXT    NOT NULL,
  note          TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_tool_id  ON transactions (tool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp);

-- ── Audit log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT    NOT NULL PRIMARY KEY,
  tool_id    TEXT    NOT NULL,
  timestamp  INTEGER NOT NULL,
  changed_by TEXT,
  fields     TEXT    NOT NULL  -- JSON array of AuditField
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tool_id   ON audit_log (tool_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp);

-- ── Snapshots ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS snapshots (
  id         TEXT    NOT NULL PRIMARY KEY,
  created_at INTEGER NOT NULL,
  label      TEXT,
  tool_count INTEGER NOT NULL DEFAULT 0,
  data       TEXT    NOT NULL  -- full LibrarySnapshot JSON (includes tools/materials/holders)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots (created_at);

-- ── Machines ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS machines (
  id         TEXT    NOT NULL PRIMARY KEY,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  data       TEXT    NOT NULL  -- full Machine JSON
);

CREATE INDEX IF NOT EXISTS idx_machines_created_at ON machines (created_at);
