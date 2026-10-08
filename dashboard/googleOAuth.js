// Чистые функции для OAuth2-потока Google (Authorization Code Grant) —
// тот же hand-rolled подход на fetch, что discordOAuth.js, без новых
// зависимостей (passport/google-auth-library и т.п. в репозитории нет).
// Google — опциональный способ ВХОДА в уже существующий аккаунт (всегда
// создаётся через Discord, см. dashboard/accounts.js), не отдельная
// система регистрации — поэтому здесь только identify (openid email
// profile), без googleapis-скоупов на доступ к данным пользователя.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
    return res.json();
}

async function fetchCurrentUser(accessToken) {
    const res = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google userinfo failed: ${res.status}`);
    return res.json();
}

module.exports = {
    buildAuthorizeUrl,
    exchangeCode,
    fetchCurrentUser,
};
