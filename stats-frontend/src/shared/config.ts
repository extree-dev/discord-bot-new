// Публичный Site Key Cloudflare Turnstile для /login — не секрет, как и
// Site Key у любой капчи, предназначен для встраивания в клиентский код.
// Secret Key остаётся только на бэкенде (TURNSTILE_SECRET_KEY в .env, см.
// stats-backend/turnstile.js) и сюда никогда не попадает.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFdnUKZ3Flc1LQFG';
