-- V6: аудит безопасности + login attempts (для rate-limit per email)
--
-- stats_login_attempts — все попытки входа (успешные и нет). Нужно для:
--   1. rate-limit per email (10 fail за 15 минут = блок),
--   2. аудита (кто, откуда, когда),
--   3. письма «5 неудачных попыток» на email.
--
-- stats_admin_audit — что делали админы (ban/verify/makeAdmin/reply/status).
-- Без этого при 2+ админах невозможно разобраться «кто забанил».

CREATE TABLE IF NOT EXISTS stats_login_attempts (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    ip TEXT,
    country TEXT,
    success BOOLEAN NOT NULL,
    reason TEXT,                       -- invalid_credentials / banned / totp_failed / ...
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stats_login_attempts_email_created_idx
    ON stats_login_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS stats_login_attempts_ip_created_idx
    ON stats_login_attempts (ip, created_at DESC);

CREATE TABLE IF NOT EXISTS stats_admin_audit (
    id BIGSERIAL PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES stats_users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,              -- ban_user / verify_user / make_admin / ticket_reply / ticket_status / canned_create / canned_delete
    target_type TEXT,                  -- user / ticket / canned_response
    target_id TEXT,
    metadata JSONB,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stats_admin_audit_admin_created_idx
    ON stats_admin_audit (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stats_admin_audit_created_idx
    ON stats_admin_audit (created_at DESC);