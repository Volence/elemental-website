-- ============================================
-- Add Monitoring Collections to Locked Documents Relations
-- ============================================
-- This adds the necessary columns to track locked documents for the new monitoring collections

ALTER TABLE payload_locked_documents_rels 
ADD COLUMN IF NOT EXISTS audit_logs_id integer REFERENCES audit_logs(id) ON DELETE CASCADE;

ALTER TABLE payload_locked_documents_rels 
ADD COLUMN IF NOT EXISTS error_logs_id integer REFERENCES error_logs(id) ON DELETE CASCADE;

ALTER TABLE payload_locked_documents_rels 
ADD COLUMN IF NOT EXISTS cron_job_runs_id integer REFERENCES cron_job_runs(id) ON DELETE CASCADE;

ALTER TABLE payload_locked_documents_rels 
ADD COLUMN IF NOT EXISTS active_sessions_id integer REFERENCES active_sessions(id) ON DELETE CASCADE;

\echo '✅ Locked documents columns added successfully!'

