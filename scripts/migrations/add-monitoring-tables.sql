-- ============================================
-- Admin Monitoring System - Production Migration
-- ============================================
-- This script creates all necessary tables for the admin monitoring system.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- NO DATA LOSS - Only creates new tables, never drops or deletes.

-- Audit Logs Collection
CREATE TABLE IF NOT EXISTS audit_logs (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id),
  action varchar(50) NOT NULL,
  collection varchar(100),
  document_id varchar(255),
  document_title varchar(255),
  metadata jsonb,
  ip_address varchar(45),
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Error Logs Collection
CREATE TABLE IF NOT EXISTS error_logs (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id),
  error_type varchar(50) NOT NULL,
  message text NOT NULL,
  stack text,
  url text,
  severity varchar(20) NOT NULL DEFAULT 'medium',
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  notes text,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Cron Job Runs Collection
CREATE TABLE IF NOT EXISTS cron_job_runs (
  id serial PRIMARY KEY,
  job_name varchar(100) NOT NULL,
  status varchar(20) NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  duration numeric,
  summary jsonb,
  errors text,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Active Sessions Collection
CREATE TABLE IF NOT EXISTS active_sessions (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id) NOT NULL,
  login_time timestamp with time zone NOT NULL,
  last_activity timestamp with time zone NOT NULL,
  ip_address varchar(45),
  user_agent text,
  is_active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Error Harvester State Global
CREATE TABLE IF NOT EXISTS error_harvester_state (
  id serial PRIMARY KEY,
  last_checked_at timestamp with time zone,
  last_run_errors numeric,
  total_run_count numeric,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Initialize error harvester state
INSERT INTO error_harvester_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Globals for UI views (empty tables, just for Payload schema)
CREATE TABLE IF NOT EXISTS audit_log_viewer (
  id serial PRIMARY KEY,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cron_monitor (
  id serial PRIMARY KEY,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS error_dashboard (
  id serial PRIMARY KEY,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS active_sessions_viewer (
  id serial PRIMARY KEY,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS database_health (
  id serial PRIMARY KEY,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Insert default rows for globals
INSERT INTO audit_log_viewer (id) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO cron_monitor (id) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO error_dashboard (id) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO active_sessions_viewer (id) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO database_health (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_created ON cron_job_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON active_sessions(is_active);

-- Success message
\echo '✅ Monitoring tables created successfully!'
\echo ''
\echo 'Created tables:'
\echo '  - audit_logs'
\echo '  - error_logs'
\echo '  - cron_job_runs'
\echo '  - active_sessions'
\echo '  - error_harvester_state'
\echo '  - audit_log_viewer (global)'
\echo '  - cron_monitor (global)'
\echo '  - error_dashboard (global)'
\echo '  - active_sessions_viewer (global)'
\echo '  - database_health (global)'
\echo ''
\echo '📊 Indexes created for optimal performance'
\echo ''

