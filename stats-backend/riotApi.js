// Обёртка над Riot Account-V1 (поиск PUUID по Riot ID — "Имя#Тег").
//
// VALORANT Match-V1 (сами матчи, K/D, карты) этому ключу НЕДОСТУПЕН —
// проверено напрямую: запрос к /val/match/v1/matchlists/by-puuid/{puuid}
// возвращает 403 на всех региональных хостах (ap/na/eu/kr/latam/br), хотя
// account-v1 на том же ключе отвечает 200. Это соответствует официальной
// документации Riot (developer.riotgames.com/docs/valorant): "Personal Key
// Applications are currently not supported" для доступа к матч-данным —
// Riot выдаёт его только одобренному продукту, а сами данные игрока
// требуют его явного согласия через RSO (см. riotOAuth.js). Поэтому здесь
// реализован только account-v1 — честная "проверка, что аккаунт
// существует", а не статистика, которую пока неоткуда взять.
//
// Account-v1 отвечает одинаково с любого из трёх континентальных хостов
// (americas/asia/europe — проверено вручную на japanese Riot ID), поэтому
// routing региона игрока здесь не нужен.
const ACCOUNT_HOST = 'https://americas.api.riotgames.com';

async function lookupRiotAccount(gameName, tagLine) {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) return { configured: false };

    const url = `${ACCOUNT_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const res = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });

    if (res.status === 404) return { configured: true, found: false };
    if (!res.ok) throw new Error(`Riot account lookup failed: ${res.status}`);

    const data = await res.json();
    return { configured: true, found: true, gameName: data.gameName, tagLine: data.tagLine };
}

module.exports = { lookupRiotAccount };
