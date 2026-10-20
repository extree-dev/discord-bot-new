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
// Documentation"). Часть деталей ниже подтверждена официальным
// туториалом Riot по внедрению RSO ("Implementing Riot Sign On"), часть
// всё ещё лучшее предположение — и это нужно перепроверить, когда Riot
// реально выдаст RSO-клиент:
//   - Client-авторизация на /token: Riot выдаёт клиент с одним из двух
//     методов — "Client Secret Basic" (как реализовано здесь — client_id
//     + client_secret в теле запроса, тот же паттерн, что у Discord/
//     Google/GitHub в этом проекте) либо "Private Key JWT" (подписанный
//     приватным ключом client_assertion) — какой именно, сообщает сам
//     Riot при выдаче клиента.
//   - PKCE: не подтверждено, требует ли /authorize code_challenge —
//     пока не реализован.
//   - scope: 'openid offline_access' — ПОДТВЕРЖДЕНО туториалом Riot:
//     openid обязателен, offline_access — опциональный scope именно для
//     refresh-токенов (ровно то, что здесь и запрашивается). Есть ещё
//     необязательный scope 'cpid' (игровой регион) — не запрашивается,
//     пока не понадобится для региональной маршрутизации VALORANT API.
//   - identity-эндпоинт: используется стандартный OIDC /userinfo — ПОДТВЕРЖДЕНО
//     туториалом Riot (возвращает claim'ы вроде sub/cpid по Bearer-токену).
//     Для доступа к самому VALORANT API (матчи, ранг) этого НЕДОСТАТОЧНО —
//     PUUID игрока нужно получать отдельным вызовом
//     /riot/account/v1/accounts/me на региональном хосте (americas/europe/
//     asia) с тем же access_token (см. developer.riotgames.com/docs/valorant)
//     — это пока не реализовано, т.к. матч-данные ещё не строятся.
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
