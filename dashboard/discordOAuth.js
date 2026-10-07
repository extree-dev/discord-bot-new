// Чистые функции для OAuth2-потока Discord (Authorization Code Grant).
// Дашборд не хранит ничего в БД — сессия целиком живёт в зашифрованной
// cookie (см. dashboard/session.js), поэтому обмен кода на токен и
// чтение профиля/серверов держим отдельно от Express-роутинга
// (dashboard/server.js) — тестируется без поднятия HTTP-сервера, с
// подменой глобального fetch.
const DISCORD_API = 'https://discord.com/api/v10';
const ADMINISTRATOR = 0x8n;

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify guilds',
        state,
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
    });
    const res = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`);
    return res.json();
}

async function fetchCurrentUser(accessToken) {
    const res = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Discord /users/@me failed: ${res.status}`);
    return res.json();
}

async function fetchUserGuilds(accessToken) {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Discord /users/@me/guilds failed: ${res.status}`);
    return res.json();
}

async function fetchBotGuilds(botToken) {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) throw new Error(`Discord bot /users/@me/guilds failed: ${res.status}`);
    return res.json();
}

// Живой список каналов/ролей сервера — на боте-токене (не требует живого
// discord.js-клиента, обычный REST), нужен дашборду, чтобы вместо "вставь
// ID канала руками" показывать нормальный выпадающий список с именами
// (см. GET /api/guild-channels и /api/guild-roles в dashboard/server.js).
async function fetchGuildChannels(botToken, guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) throw new Error(`Discord guild channels failed: ${res.status}`);
    return res.json();
}

async function fetchGuildRoles(botToken, guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) throw new Error(`Discord guild roles failed: ${res.status}`);
    return res.json();
}

// Сырые роли сервера (с битами permissions) — в отличие от
// fetchGuildRoles выше (которая фильтрует managed/@everyone и отдаёт
// только id/name/position для пикера в UI), нужны для пересчёта
// реальных прав участника в isMemberAdmin ниже.
async function fetchRawGuildRoles(botToken, guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) throw new Error(`Discord guild roles failed: ${res.status}`);
    return res.json();
}

async function fetchGuild(botToken, guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) throw new Error(`Discord guild fetch failed: ${res.status}`);
    return res.json();
}

// null, если пользователь не состоит на сервере (а не бросает —
// 404 здесь штатный случай, не ошибка).
async function fetchGuildMember(botToken, guildId, userId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Discord guild member fetch failed: ${res.status}`);
    return res.json();
}

// Пересчитывает права участника из его role id-шников и сырых ролей
// сервера — чистая функция (без сети), поэтому тестируется отдельно от
// isGuildAdminById ниже, которая уже дёргает Discord API.
function isMemberAdmin({ ownerId, member, roles }) {
    if (!member) return false;
    if (ownerId && member.user?.id === ownerId) return true;
    const roleById = new Map(roles.map(r => [r.id, r]));
    const permissions = (member.roles || []).reduce((acc, roleId) => {
        const role = roleById.get(roleId);
        return role ? acc | BigInt(role.permissions) : acc;
    }, 0n);
    return (permissions & ADMINISTRATOR) === ADMINISTRATOR;
}

// Та же проверка прав администратора, что isSiteAdmin ниже, но по
// discordId напрямую через бот-токен — без живого OAuth access_token
// пользователя. Это то, что позволяет правам работать одинаково вне
// зависимости от способа входа (Discord/Telegram/email, см.
// dashboard/accounts.js): пока у аккаунта есть привязанный discordId,
// права каждый раз проверяются заново у Discord ботом, а не берутся из
// токена, который мог протухнуть или которого вовсе нет (вход не через
// Discord).
async function isGuildAdminById(botToken, guildId, discordId) {
    const [guild, member] = await Promise.all([
        fetchGuild(botToken, guildId),
        fetchGuildMember(botToken, guildId, discordId),
    ]);
    if (!member) return false;
    const roles = await fetchRawGuildRoles(botToken, guildId);
    return isMemberAdmin({ ownerId: guild.owner_id, member, roles });
}

// true, если участник — владелец сервера или у него есть право
// Administrator. permissions приходит от Discord строкой и может
// превышать 32 бита, поэтому сравниваем через BigInt, а не побитовыми
// операторами JS (они работают только с 32-битными int).
function isGuildAdmin(guild) {
    if (guild.owner) return true;
    if (!guild.permissions) return false;
    return (BigInt(guild.permissions) & ADMINISTRATOR) === ADMINISTRATOR;
}

// Пересечение серверов пользователя и серверов бота, только там, где
// пользователь админ/владелец — ровно то, что можно показать в дашборде
// версии "только просмотр" (без него пришлось бы показывать либо все
// сервера пользователя, либо все сервера бота — и то, и другое не то).
function intersectManagedGuilds(userGuilds, botGuilds) {
    const botGuildIds = new Set(botGuilds.map(g => g.id));
    return userGuilds.filter(g => isGuildAdmin(g) && botGuildIds.has(g.id));
}

// Гейт для /admin (редактирование визитки extree.tech): "администратор
// домена" здесь — тот, у кого есть право Administrator (или кто владелец)
// на самом сервере бота (GUILD_ID из .env), а не произвольный Discord-
// пользователь. Тот же критерий, что уже используется для списка серверов
// в личном кабинете (isGuildAdmin) — просто проверяем ровно один guildId
// вместо пересечения со списком серверов бота.
function isSiteAdmin(userGuilds, guildId) {
    if (!guildId) return false;
    const guild = userGuilds.find(g => g.id === guildId);
    return guild ? isGuildAdmin(guild) : false;
}

module.exports = {
    buildAuthorizeUrl,
    exchangeCode,
    fetchCurrentUser,
    fetchUserGuilds,
    fetchBotGuilds,
    fetchGuildChannels,
    fetchGuildRoles,
    fetchGuild,
    fetchGuildMember,
    isGuildAdmin,
    isMemberAdmin,
    isGuildAdminById,
    intersectManagedGuilds,
    isSiteAdmin,
};
