// Доменный слой репутации: уровни/титулы, выдача/профиль/рейтинг,
// автороль при повышении уровня, еженедельный рейтинг с изменением
// позиций. Чистые функции (getLevel/computeCooldown/buildLeaderboardMovement)
// не трогают Discord API и покрыты тестами отдельно от
// giveReputation/checkAndPostLeaderboard.
const { AttachmentBuilder } = require('discord.js');
const { COLORS, formatBody } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const { renderRankCard } = require('./rankCardImage');
const config = require('./config');

// Пороги — не эмодзи-бейджи, а титулы: единственный способ показать
// "уровень" без визуального мусора, но так, чтобы рост чувствовался.
const LEVELS = [
    { title: 'Новичок', min: 0 },
    { title: 'Участник', min: 5 },
    { title: 'Активный участник', min: 15 },
    { title: 'Уважаемый', min: 30 },
    { title: 'Авторитет', min: 60 },
    { title: 'Легенда сервера', min: 100 },
    { title: 'Икона сообщества', min: 200 },
];

const GIVE_COOLDOWN_MS = 20 * 60 * 60 * 1000; // 20ч между репутацией одному и тому же человеку
const DAILY_GIVE_LIMIT = 5; // максимум разным людям в сутки — от накрутки/сговора
const LEADERBOARD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 20;

function userKey(guildId, userId) {
    return `${guildId}_${userId}`;
}

// Индекс уровня в LEVELS для данного счёта — последний порог, который
// счёт уже прошёл.
function getLevelIndex(score) {
    let index = 0;
    for (let i = 0; i < LEVELS.length; i++) {
        if (score >= LEVELS[i].min) index = i;
    }
    return index;
}

// {index, title, min, next: {title, min} | null, progress: 0..1 до
// следующего уровня} — progress всегда 1 на максимальном уровне (нет
// следующего порога, куда расти).
function getLevel(score) {
    const index = getLevelIndex(score);
    const current = LEVELS[index];
    const next = LEVELS[index + 1] ?? null;
    const progress = next ? (score - current.min) / (next.min - current.min) : 1;
    return { index, title: current.title, min: current.min, next, progress };
}

// Сколько миллисекунд осталось до конца кулдауна между парой
// (from, to); 0, если можно давать репутацию прямо сейчас.
function computeCooldownRemaining(lastGivenAt, now, cooldownMs = GIVE_COOLDOWN_MS) {
    if (!lastGivenAt) return 0;
    return Math.max(0, cooldownMs - (now - lastGivenAt));
}

// Сколько разным людям уже дали репутацию за последние 24 часа — не
// хранится отдельным счётчиком, а считается по givenTo напрямую, чтобы
// не разъезжаться с ним при отмене/ошибке записи.
function countRecentGivenTo(givenTo, now, windowMs = 24 * 60 * 60 * 1000) {
    return Object.values(givenTo ?? {}).filter(ts => now - ts < windowMs).length;
}

// Движение в рейтинге относительно предыдущего снимка — "+N"/"-N"/"="/
// "новый" (не было в прошлом снимке). Чистая функция для теста и для
// buildLeaderboardCard.
function buildLeaderboardMovement(currentTop, previousSnapshot) {
    const previousRank = new Map((previousSnapshot ?? []).map((e, i) => [e.userId, i]));
    return currentTop.map((entry, i) => {
        const prevIndex = previousRank.get(entry.userId);
        let movement;
        if (prevIndex === undefined) movement = 'новый';
        else if (prevIndex === i) movement = '=';
        else if (prevIndex > i) movement = `+${prevIndex - i}`;
        else movement = `-${i - prevIndex}`;
        return { ...entry, rank: i + 1, movement };
    });
}

async function giveReputation(guildId, fromId, toId) {
    if (fromId === toId) return { error: 'Нельзя дать репутацию самому себе.' };

    const now = Date.now();
    const result = await config.update(cfg => {
        const fromKey = userKey(guildId, fromId);
        const fromUser = cfg.users[fromKey] ?? { score: 0, givenTo: {}, history: [] };

        const cooldownLeft = computeCooldownRemaining(fromUser.givenTo[toId], now);
        if (cooldownLeft > 0) return { error: 'cooldown', cooldownLeft };

        if (countRecentGivenTo(fromUser.givenTo, now) >= DAILY_GIVE_LIMIT) {
            return { error: 'daily-limit' };
        }

        const toKey = userKey(guildId, toId);
        const toUser = cfg.users[toKey] ?? { score: 0, givenTo: {}, history: [] };
        const oldScore = toUser.score;
        const oldLevelIndex = getLevelIndex(oldScore);
        toUser.score += 1;
        toUser.history = [{ fromId, date: now }, ...toUser.history].slice(0, HISTORY_LIMIT);
        const newLevelIndex = getLevelIndex(toUser.score);
        cfg.users[toKey] = toUser;

        fromUser.givenTo = { ...fromUser.givenTo, [toId]: now };
        cfg.users[fromKey] = fromUser;

        return {
            newScore: toUser.score,
            // Первое очко вообще не двигает индекс уровня (0 и 1-4 — оба
            // "Новичок"), но именно на нём роль нужно выдать первый раз —
            // leveledUp тут всегда false, поэтому это отдельный флаг, а
            // не частный случай сравнения индексов.
            firstPoint: oldScore === 0,
            leveledUp: newLevelIndex > oldLevelIndex,
            levelIndex: newLevelIndex,
        };
    });

    if (result.error === 'cooldown') {
        return {
            error: `Ты уже давал репутацию этому человеку недавно. Попробуй через ${formatRemaining(result.cooldownLeft)}.`,
        };
    }
    if (result.error === 'daily-limit') {
        return { error: `Дневной лимит репутации разным людям (${DAILY_GIVE_LIMIT}) уже использован.` };
    }
    return result;
}

// "3 ч 20 мин" — не переиспользую formatDuration из tickets/model.js,
// чтобы reputation/ не тянул зависимость на tickets/ (не связанные
// друг с другом фичи, см. FSD-границы фич в README).
function formatRemaining(ms) {
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (hours) parts.push(`${hours} ч`);
    parts.push(`${minutes} мин`);
    return parts.join(' ');
}

async function getLeaderboard(guildId, limit = 10) {
    const cfg = await config.load();
    const prefix = `${guildId}_`;
    // score > 0 — иначе рейтинг заполняется случайными нулями от всех,
    // кто хоть раз кому-то дал репутацию, но сам её никогда не получал
    // (их запись в cfg.users создаётся для кулдауна/дневного лимита, а
    // не потому что у них есть репутация).
    const entries = Object.entries(cfg.users)
        .filter(([key, u]) => key.startsWith(prefix) && u.score > 0)
        .map(([key, u]) => ({ userId: key.slice(prefix.length), score: u.score }))
        .sort((a, b) => b.score - a.score);
    return entries.slice(0, limit);
}

async function getProfile(guildId, userId) {
    const cfg = await config.load();
    const user = cfg.users[userKey(guildId, userId)] ?? { score: 0, givenTo: {}, history: [] };
    const leaderboard = await getLeaderboard(guildId, Infinity);
    const rank = leaderboard.findIndex(e => e.userId === userId) + 1;
    return { score: user.score, level: getLevel(user.score), rank: rank || null, history: user.history };
}

async function setReputation(guildId, userId, score) {
    return config.update(cfg => {
        const key = userKey(guildId, userId);
        const user = cfg.users[key] ?? { score: 0, givenTo: {}, history: [] };
        user.score = Math.max(0, score);
        cfg.users[key] = user;
        return { newScore: user.score, level: getLevel(user.score) };
    });
}

async function fetchImageBuffer(url) {
    if (!url) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
}

// Профиль репутации — целиком одна картинка (баннер профиля как фон,
// круглый аватар, имя/уровень/счёт/полоса), не embed/Components V2 с
// текстом. force: true при получении пользователя обязателен — баннер
// не входит в частичные данные из кэша/resolved interaction, только в
// полный fetch. Если баннера у пользователя нет вообще — renderRankCard
// сам подставляет градиент вместо фона.
async function buildRankCardAttachment(client, userId, { score, level, rank }) {
    const user = await client.users.fetch(userId, { force: true }).catch(() => null);
    const displayName = user?.globalName ?? user?.username ?? 'Пользователь';
    const avatarUrl = user?.displayAvatarURL({ extension: 'png', size: 256 }) ?? null;
    const bannerUrl = user?.bannerURL({ extension: 'png', size: 600 }) ?? null;

    const [avatarBuffer, bannerBuffer] = await Promise.all([fetchImageBuffer(avatarUrl), fetchImageBuffer(bannerUrl)]);

    const png = await renderRankCard({ displayName, avatarBuffer, bannerBuffer, level, score, rank });
    return new AttachmentBuilder(png, { name: 'rank-card.png' });
}

function buildLevelUpCard(user, level) {
    return baseContainer(COLORS.success).addTextDisplayComponents(
        textDisplay(formatBody('Новый уровень репутации', `${user} теперь «${level.title}»!`))
    );
}

function buildLeaderboardCard(entries, title = 'Рейтинг репутации') {
    const lines = entries.map(e => `**#${e.rank}** <@${e.userId}> — ${e.score}${e.movement ? ` (${e.movement})` : ''}`);
    return baseContainer(COLORS.primary)
        .addTextDisplayComponents(textDisplay(formatBody(title)))
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(textDisplay(lines.join('\n') || 'Пока никто не получил репутацию.'));
}

// Еженедельный автопост рейтинга с изменением позиций относительно
// предыдущего — вызывается по таймеру (см. index.js регистрацию) для
// каждой гильдии, где настроен announceChannelId.
async function checkAndPostLeaderboard(client) {
    const cfg = await config.load();
    const now = Date.now();

    for (const [guildId, guildCfg] of Object.entries(cfg.guilds)) {
        if (!guildCfg.announceChannelId) continue;
        if (now - (guildCfg.lastLeaderboardAt ?? 0) < LEADERBOARD_INTERVAL_MS) continue;

        const top = await getLeaderboard(guildId, 10);
        if (!top.length) continue;

        const channel =
            client.channels.cache.get(guildCfg.announceChannelId) ??
            (await client.channels.fetch(guildCfg.announceChannelId).catch(() => null));
        if (!channel) continue;

        const withMovement = buildLeaderboardMovement(top, guildCfg.lastSnapshot);
        await channel
            .send(toMessage(buildLeaderboardCard(withMovement, 'Рейтинг репутации за неделю')))
            .catch(() => {});

        await config.update(c => {
            if (!c.guilds[guildId]) c.guilds[guildId] = {};
            c.guilds[guildId].lastLeaderboardAt = now;
            c.guilds[guildId].lastSnapshot = top;
        });
    }
}

async function getLevelRoleId(guildId, levelIndex) {
    const cfg = await config.load();
    return cfg.guilds[guildId]?.levelRoles?.[levelIndex] ?? null;
}

// Вызывается из scripts/setup-reputation.js, чтобы предпочесть уже
// сохранённые announceChannelId/levelRoles поиску по имени — иначе
// переименованный вручную канал/роль уровня считался бы "не найденным"
// при следующем деплое и получал бы дубликат с дефолтным именем.
async function getGuildConfig(guildId) {
    const cfg = await config.load();
    return cfg.guilds[guildId] ?? {};
}

// Вызывается из scripts/setup-reputation.js — сохраняет канал для
// автопостов рейтинга/level-up и карту "индекс уровня → роль", созданную
// скриптом. Отдельная функция, а не прямой config.update() из скрипта —
// scripts/ обращаются к фиче только через её публичный API (см. index.js).
async function configureGuild(guildId, { channelId, levelRoles }) {
    await config.update(cfg => {
        const guildCfg = cfg.guilds[guildId] ?? {};
        if (channelId !== undefined) guildCfg.announceChannelId = channelId;
        if (levelRoles !== undefined) guildCfg.levelRoles = levelRoles;
        cfg.guilds[guildId] = guildCfg;
    });
}

module.exports = {
    LEVELS,
    GIVE_COOLDOWN_MS,
    DAILY_GIVE_LIMIT,
    getLevelIndex,
    getLevel,
    computeCooldownRemaining,
    countRecentGivenTo,
    buildLeaderboardMovement,
    formatRemaining,
    giveReputation,
    getLeaderboard,
    getProfile,
    setReputation,
    getLevelRoleId,
    getGuildConfig,
    configureGuild,
    buildRankCardAttachment,
    buildLevelUpCard,
    buildLeaderboardCard,
    checkAndPostLeaderboard,
};
