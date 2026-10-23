-- V9: таблица login attempts (rate-limit per email + audit).
-- На проде существует, IF NOT EXISTS — no-op. На новом стенде создаёт с нуля.

CREATE TABLE IF NOT EXISTS stats_login_attempts (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    ip TEXT,
    country TEXT,
    success BOOLEAN NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stats_login_attempts_email_created_idx
    ON stats_login_attempts (email, created_at DESC);

CREATE INDEX IF NOT EXISTS stats_login_attempts_failed_idx
    ON stats_login_attempts (email, success, created_at DESC);
