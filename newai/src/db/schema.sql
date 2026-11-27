-- newai 데이터베이스 스키마 v1
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, path TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('new','existing')),
  commit_enabled INTEGER NOT NULL DEFAULT 0, language TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id),
  kind TEXT NOT NULL CHECK (kind IN ('chat','pipeline','server-check','batch')),
  request TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_decision','suspended','done','needs_human','failed','cancelled')),
  after_job_id TEXT, session_id TEXT, pipeline_stage TEXT, attempt INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT
);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), model TEXT,
  last_total_cost_usd REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, ts TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_job ON events(job_id, id);
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY, job_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('ask','plan','permission','tail','clarify','bridge','rule')),
  question TEXT NOT NULL, candidates TEXT NOT NULL,
  policy_level TEXT NOT NULL CHECK (policy_level IN ('allow','wait','human','deny')),
  status TEXT NOT NULL CHECK (status IN ('pending','paused','resolved','cancelled')),
  preselected TEXT, resolved_by TEXT CHECK (resolved_by IN ('human','auto','preselect','policy')),
  answer TEXT, created_at TEXT NOT NULL, deadline_at TEXT, paused_ms INTEGER NOT NULL DEFAULT 0, paused_at TEXT, resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS decisions_status ON decisions(status);
CREATE TABLE IF NOT EXISTS interruptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
  cause TEXT NOT NULL CHECK (cause IN ('wall_clock','budget','restart','usage_limit','network')),
  detail TEXT, wait_until TEXT, attempt INTEGER NOT NULL, created_at TEXT NOT NULL, resumed_at TEXT
);
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL CHECK (scope IN ('project','global')), project_id TEXT,
  text TEXT NOT NULL, origin TEXT NOT NULL CHECK (origin IN ('auto','manual')),
  status TEXT NOT NULL CHECK (status IN ('active','proposed','disabled')), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, job_id TEXT NOT NULL,
  summary TEXT NOT NULL, pending_items TEXT, cancelled_unanswered TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY, cron TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1, last_run_at TEXT
);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
