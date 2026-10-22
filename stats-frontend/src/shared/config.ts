// Публичный Site Key Cloudflare Turnstile для /login — не секрет, как и
// Site Key у любой капчи, предназначен для встраивания в клиентский код.
// Secret Key остаётся только на бэкенде (TURNSTILE_SECRET_KEY в .env, см.
// stats-backend/turnstile.js) и сюда никогда не попадает.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAFdnUKZ3Flc1LQFG';

// DSN мониторинга ошибок (Sentry, проект stats-frontend в организации
// extree-stats) — как и DSN вообще, не секрет: предназначен именно для
// встраивания в клиентский код (см. документацию Sentry), поэтому хранится
// тут же, рядом с Turnstile Site Key, а не в .env.
export const SENTRY_DSN =
    'https://a898e179330f64530d537a31dd4fea5d@o4512294454034432.ingest.de.sentry.io/4512294488703056';
