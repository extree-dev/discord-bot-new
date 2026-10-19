// Чистые функции для OAuth2/OIDC-потока Riot Sign-On (RSO) — тот же
// паттерн разделения, что у dashboard/discordOAuth.js (и googleOAuth.js/
// githubOAuth.js): обмен кода на токен и чтение identity отдельно от
// Express-роутинга (server.js), чтобы тестировалось без поднятия HTTP.
//
// ВАЖНО — незавершённые детали протокола. На момент написания у Extree
// Stats ещё нет client_id/client_secret: заявка на продукт в Riot
// Developer Portal — Pending Review, а RSO-доступ Riot выдаёт ОТДЕЛЬНЫМ
// приглашением уже ПОСЛЕ одобрения продукта (см. официальные статьи
// support-developer.riotgames.com — "RSO - Riot Sign-On" и "OAuth Client
// Documentation"). Поэтому часть деталей ниже — лучшее предположение по
// открытым (не всегда официальным) источникам, а НЕ подтверждённая
// документация, и это нужно перепроверить, когда Riot реально выдаст
// RSO-клиент:
//   - Client-авторизация на /token: Riot выдаёт клиент с одним из двух
//     методов — "Client Secret Basic" (как реализовано здесь — client_id
//     + client_secret в теле запроса, тот же паттерн, что у Discord/
//     Google/GitHub в этом проекте) либо "Private Key JWT" (подписанный
//     приватным ключом client_assertion) — какой именно, сообщает сам
//     Riot при выдаче клиента.
//   - PKCE: не подтверждено, требует ли /authorize code_challenge —
//     пока не реализован.
//   - scope: 'openid offline_access' — по аналогии с другими OIDC-
//     провайдерами в этом проекте; какой scope реально нужен для доступа
//     к PUUID игрока через VALORANT API, нужно свериться с настоящей
//     RSO-докой.
//   - identity-эндпоинт: используется стандартный OIDC /userinfo;
//     возможно, PUUID для VALORANT API нужно получать отдельно через
//     account-v1 с тем же access_token — тоже требует проверки.
const RIOT_AUTH_HOST = 'https://auth.riotgames.com';

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid offline_access',
        state,
    });
    return `${RIOT_AUTH_HOST}/authorize?${params.toString()}`;
}

async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
    });
    const res = await fetch(`${RIOT_AUTH_HOST}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!res.ok) throw new Error(`Riot token exchange failed: ${res.status}`);
    return res.json();
}

async function fetchIdentity(accessToken) {
    const res = await fetch(`${RIOT_AUTH_HOST}/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Riot userinfo failed: ${res.status}`);
    return res.json();
}

module.exports = { buildAuthorizeUrl, exchangeCode, fetchIdentity };
