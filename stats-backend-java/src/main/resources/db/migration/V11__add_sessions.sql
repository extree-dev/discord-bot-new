-- V11: реестр сессий (stats_sessions) — замена полностью stateless cookie
-- на отзываемую серверную сессию (см. JdbcSessionRepository). Эта же
-- таблица была добавлена в stats-backend/db.js (Node) при первой реализации,
-- но ensureSchema() там выполняется только изнутри Node-роутов, а Caddy
-- шлёт весь /auth/*, /api/* исключительно на stats-backend-java — то есть
-- Node-путь никогда не вызывается, и на проде эта таблица не создавалась
-- вообще. Отсюда и баг: login/confirm-location падал на INSERT в
-- несуществующую таблицу. Flyway (эта миграция) — единственный путь,
-- который реально выполняется сервисом, который реально обслуживает трафик.
CREATE TABLE IF NOT EXISTS stats_sessions (
    id TEXT PRIMARY KEY,
    sub TEXT,
    user_id TEXT REFERENCES stats_users(id) ON DELETE CASCADE,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stats_sessions_user_idx ON stats_sessions (user_id);

ALTER TABLE stats_login_events ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES stats_sessions(id) ON DELETE SET NULL;
