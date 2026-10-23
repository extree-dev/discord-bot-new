-- V8: таблица admin audit log.
-- На проде таблица уже существует (создана вручную), IF NOT EXISTS — no-op.
-- На новом стенде создаёт с нуля, чтобы record() из JdbcAdminAuditRepository
-- не падал на relation does not exist.

CREATE TABLE IF NOT EXISTS stats_admin_audit (
    id BIGSERIAL PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES stats_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    metadata JSONB,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stats_admin_audit_created_idx
    ON stats_admin_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS stats_admin_audit_admin_idx
    ON stats_admin_audit (admin_id, created_at DESC);
