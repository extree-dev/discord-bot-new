-- V7: TOTP 2FA + HIBP-кеш
--
-- stats_user_totp_secrets — один секрет на юзера (пока не enabled,
-- enabled_at NULL). recovery_codes_hashed — JSONB-массив bcrypt-хешей
-- одноразовых кодов восстановления.
--
-- stats_password_hibp_cache — кеш ответов HIBP k-anonymity (prefix → suffix list).
-- TTL 24 часа, обновляется по расписанию/при первом запросе.

CREATE TABLE IF NOT EXISTS stats_user_totp_secrets (
    user_id TEXT PRIMARY KEY REFERENCES stats_users(id) ON DELETE CASCADE,
    secret_encrypted TEXT NOT NULL,        -- base32 TOTP секрет (в идеале — зашифрован AES, но пока plaintext для простоты)
    enabled_at TIMESTAMPTZ,                -- NULL = ещё не активирован
    recovery_codes_hashed JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stats_password_hibp_cache (
    sha1_prefix CHAR(5) PRIMARY KEY,
    suffixes TEXT NOT NULL,                -- "\r\n"-separated "suffix:count"
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stats_password_hibp_cache_fetched_idx
    ON stats_password_hibp_cache (fetched_at);