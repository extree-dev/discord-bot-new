// Чистые функции для OAuth2-потока GitHub (Authorization Code Grant) —
// тот же hand-rolled подход на fetch, что googleOAuth.js/discordOAuth.js,
// без новых зависимостей. GitHub — опциональный способ ВХОДА в уже
// существующий аккаунт (всегда создаётся через Discord, см.
// dashboard/accounts.js), не отдельная система регистрации — поэтому
// здесь только read:user, без доступа к репозиториям и т.п.
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
// GitHub требует User-Agent на все запросы к API — без него отвечает 403.
const USER_AGENT = 'Extree-Dashboard';

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'read:user',
        state,
    });
    return `${GITHUB_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
    });
    const res = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // Без этого GitHub отвечает application/x-www-form-urlencoded
            // вместо JSON на сам обмен кода на токен.
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
        },
        body,
    });
    if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status}`);
    return res.json();
}

async function fetchCurrentUser(accessToken) {
    const res = await fetch(GITHUB_USER_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': USER_AGENT,
        },
    });
    if (!res.ok) throw new Error(`GitHub userinfo failed: ${res.status}`);
    return res.json();
}

module.exports = {
    buildAuthorizeUrl,
    exchangeCode,
    fetchCurrentUser,
};
