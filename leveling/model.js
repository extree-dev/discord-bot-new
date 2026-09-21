// Доменный слой уровней активности: уровни/титулы, начисление очков за
// сообщения и голос, профиль/топ, автороль при повышении уровня,
// еженедельный топ с изменением позиций. Чистые функции
// (getLevel/canCountMessage/buildLeaderboardMovement) не трогают Discord
// API и покрыты тестами отдельно от addTextPoint/flushVoiceMinutes/
// checkAndPostLeaderboard.
//
// Замена бывшей системы репутации (reputation/, удалена целиком):
// раньше уровень рос от того, что другие люди ДАВАЛИ репутацию — теперь
// он растёт от собственной активности (сообщения + голосовые), очки
// начисляются автоматически, без команды "дать". Роль стартового уровня
// теперь выдаётся при верификации (security/verification.js), а не при
// первом очке — см. LEVELS[0].min === 0.
const { AttachmentBuilder } = require('discord.js');
const { COLORS, formatBody } = require('../utils/embeds');
const { baseContainer, textDisplay } = require('../utils/components');
const { renderRankCard } = require('./rankCardImage');
const { renderLeaderboardCard } = require('./leaderboardImage');
const config = require('./config');

// Титулы и цвета унаследованы от прежней системы репутации (те же роли
// уже существуют на сервере под теми же именами — см.
// scripts/setup-leveling.js, который их усыновляет по имени вместо
// создания дублей). Пороги пересчитаны под новую шкалу очков (сообщения
// + голос вместо "1 очко = 1 чужая репутация") — на порядок выше, чтобы
// уровень рос не за один вечер активности, а как реальный показатель
// вовлечённости за недели.
const LEVELS = [
    { title: 'Новичок', min: 0, color: 0x99aab5 },
    { title: 'Участник', min: 100, color: 0x2ecc71 },
    { title: 'Активный участник', min: 400, color: 0x3498db },
    { title: 'Уважаемый', min: 1200, color: 0x9b59b6 },
    { title: 'Авторитет', min: 3000, color: 0xe67e22 },
    { title: 'Легенда сервера', min: 7000, color: 0xe91e63 },
    { title: 'Икона сообщества', min: 15000, color: 0xf1c40f },
];

// Очки за одно засчитанное сообщение и за одну минуту в голосовом канале.
// Голос стоит дешевле за минуту, чем сообщение за штуку, но нет верхнего
// предела по времени (в отличие от сообщений — см. MESSAGE_COOLDOWN_MS) —
// длинные голосовые сессии всё равно дают сопоставимый вклад.
const POINTS_PER_MESSAGE = 5;
const POINTS_PER_VOICE_MINUTE = 2;
// Не каждое сообщение даёт очки — иначе спам/флуд коротких сообщений
// накручивал бы уровень быстрее реальной голосовой активности. Один
// засчитанный текстовый импульс в минуту с пользователя.
const MESSAGE_COOLDOWN_MS = 60 * 1000;

const LEADERBOARD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

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

// {index, title, min, color, next: {title, min} | null, progress: 0..1 до
// следующего уровня} — progress всегда 1 на максимальном уровне (нет
// следующего порога, куда расти).
function getLevel(score) {
    const index = getLevelIndex(score);
    const current = LEVELS[index];
    const next = LEVELS[index + 1] ?? null;
    const progress = next ? (score - current.min) / (next.min - current.min) : 1;
    return { index, title: current.title, min: current.min, color: current.color, next, progress };
}

// Кулдаун на засчитываемое сообщение — в памяти процесса, а не в БД:
// это высокочастотная проверка на каждое сообщение в сервере, гонять её
// через Postgres было бы неоправданно дорого, а точность до перезапуска
// бота тут не нужна (максимум — одно лишнее засчитанное сообщение сразу
// после рестарта). key "guildId:userId" → таймстамп последнего
// засчитанного сообщения.
const messageCooldowns = new Map();

// Проверяет кулдаун и сразу же, если он прошёл, записывает новый
// таймстамп — единая точка, а не check-then-set в двух местах (иначе
// два быстрых сообщения подряд от одного пользователя могли бы оба
// проскочить проверку до того, как первое успеет обновить Map).
function canCountMessage(guildId, userId, now = Date.now()) {
    const key = `${guildId}:${userId}`;
    const last = messageCooldowns.get(key);
    if (last !== undefined && now - last < MESSAGE_COOLDOWN_MS) return false;
    messageCooldowns.set(key, now);
    return true;
}

// Движение в топе относительно предыдущего снимка — "+N"/"-N"/"="/
// "новый" (не было в прошлом снимке). Чистая функция для теста и для
// checkAndPostLeaderboard.
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

function emptyUser() {
    return { score: 0, messageCount: 0, voiceMinutes: 0 };
}

// Вызывается из leveling/handlers.js messageCreate-обработчика уже
// ПОСЛЕ canCountMessage() (сама эта функция кулдаун не проверяет —
// иначе при вызове из другого места пришлось бы помнить о побочном
// эффекте дважды).
async function addTextPoint(guildId, userId) {
    return config.update(cfg => {
        const key = userKey(guildId, userId);
        const user = cfg.users[key] ?? emptyUser();
        const oldLevelIndex = getLevelIndex(user.score);
        user.score += POINTS_PER_MESSAGE;
        user.messageCount += 1;
        const newLevelIndex = getLevelIndex(user.score);
        cfg.users[key] = user;
        return {
            guildId,
            userId,
            newScore: user.score,
            leveledUp: newLevelIndex > oldLevelIndex,
            levelIndex: newLevelIndex,
        };
    });
}

// Батч-версия для leveling/sweep.js — один тик = одна транзакция на всех
// участников голосовых каналов разом, а не по одной транзакции на
// каждого (при большом сервере с десятками одновременно висящих в
// голосовых это была бы существенная лишняя нагрузка на Postgres каждую
// минуту). entries: [{ guildId, userId, minutes }].
async function flushVoiceMinutes(entries) {
    if (!entries.length) return [];
    return config.update(cfg => {
        const results = [];
        for (const { guildId, userId, minutes } of entries) {
            const key = userKey(guildId, userId);
            const user = cfg.users[key] ?? emptyUser();
            const oldLevelIndex = getLevelIndex(user.score);
            user.score += minutes * POINTS_PER_VOICE_MINUTE;
            user.voiceMinutes += minutes;
            const newLevelIndex = getLevelIndex(user.score);
            cfg.users[key] = user;
            results.push({
                guildId,
                userId,
                newScore: user.score,
                leveledUp: newLevelIndex > oldLevelIndex,
                levelIndex: newLevelIndex,
            });
        }
        return results;
    });
}

async function getLeaderboard(guildId, limit = 10) {
    const cfg = await config.load();
    const prefix = `${guildId}_`;
    // score > 0 — иначе топ заполняется нулевыми участниками, которые
    // просто верифицировались (получили роль "Новичок"), но ещё не
    // написали ни одного засчитанного сообщения и не заходили в голос.
    const entries = Object.entries(cfg.users)
        .filter(([key, u]) => key.startsWith(prefix) && u.score > 0)
        .map(([key, u]) => ({
            userId: key.slice(prefix.length),
            score: u.score,
            messageCount: u.messageCount ?? 0,
            voiceMinutes: u.voiceMinutes ?? 0,
        }))
        .sort((a, b) => b.score - a.score);
    return entries.slice(0, limit);
}

async function getProfile(guildId, userId) {
    const cfg = await config.load();
    const user = cfg.users[userKey(guildId, userId)] ?? emptyUser();
    const leaderboard = await getLeaderboard(guildId, Infinity);
    const rank = leaderboard.findIndex(e => e.userId === userId) + 1;
    return {
        score: user.score,
        level: getLevel(user.score),
        rank: rank || null,
        messageCount: user.messageCount ?? 0,
        voiceMinutes: user.voiceMinutes ?? 0,
    };
}

// Ручная правка счёта модерацией (замена reputation.setReputation) — не
// трогает messageCount/voiceMinutes, только итоговый score, которым
// считается уровень.
async function setScore(guildId, userId, score) {
    return config.update(cfg => {
        const key = userKey(guildId, userId);
        const user = cfg.users[key] ?? emptyUser();
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

// Профиль уровня — целиком одна картинка (баннер профиля как фон,
// круглый аватар, имя/уровень/счёт/полоса, сообщения+голос), не
// embed/Components V2 с текстом. force: true при получении пользователя
// обязателен — баннер не входит в частичные данные из кэша/resolved
// interaction, только в полный fetch. guild — опционален: без него
// карточка просто не рисует уголок с иконкой/именем сервера.
async function buildRankCardAttachment(client, userId, { score, level, rank, messageCount, voiceMinutes }, guild) {
    const user = await client.users.fetch(userId, { force: true }).catch(() => null);
    const displayName = user?.globalName ?? user?.username ?? 'Пользователь';
    const avatarUrl = user?.displayAvatarURL({ extension: 'png', size: 256 }) ?? null;
    // Discord CDN принимает только степени двойки (16..4096) — 600 не
    // валиден и ронял всю команду RangeError-ом ещё до рендера, стоило
    // только у пользователя оказаться баннеру (упало в проде на прежней
    // системе репутации — см. CHANGELOG 3.9.2). Та же грабля актуальна
    // для guildIconUrl ниже — отсюда именно 64, а не "любое удобное" число.
    const bannerUrl = user?.bannerURL({ extension: 'png', size: 1024 }) ?? null;
    const guildIconUrl = guild?.iconURL({ extension: 'png', size: 64 }) ?? null;

    const [avatarBuffer, bannerBuffer, guildIconBuffer] = await Promise.all([
        fetchImageBuffer(avatarUrl),
        fetchImageBuffer(bannerUrl),
        fetchImageBuffer(guildIconUrl),
    ]);

    const png = await renderRankCard({
        displayName,
        avatarBuffer,
        bannerBuffer,
        level,
        score,
        rank,
        messageCount,
        voiceMinutes,
        guildName: guild?.name ?? null,
        guildIconBuffer,
    });
    return new AttachmentBuilder(png, { name: 'rank-card.png' });
}

function buildLevelUpCard(user, level) {
    return baseContainer(COLORS.success).addTextDisplayComponents(
        textDisplay(formatBody('Новый уровень активности', `${user} теперь «${level.title}»!`))
    );
}

// Топ активности — одна картинка (список строк, уровень и статистика у
// каждой, медали, изменение позиции), не embed/Components V2 с текстом,
// тот же принцип, что и у buildRankCardAttachment(). entries уже
// содержат rank, score, messageCount (и movement, если он посчитан — см.
// buildLeaderboardMovement) — здесь добираем аватар по userId и считаем
// level из score (чистая функция, сетевого похода не стоит).
// client.users.fetch() без force: true — для аватара кэшированных
// данных достаточно.
async function buildLeaderboardAttachment(client, entries, title = 'Топ активности') {
    const withAvatars = await Promise.all(
        entries.map(async entry => {
            const user = await client.users.fetch(entry.userId).catch(() => null);
            const displayName = user?.globalName ?? user?.username ?? 'Пользователь';
            const avatarUrl = user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null;
            const avatarBuffer = await fetchImageBuffer(avatarUrl);
            return { ...entry, displayName, avatarBuffer, level: getLevel(entry.score) };
        })
    );

    const png = await renderLeaderboardCard({ title, entries: withAvatars });
    return new AttachmentBuilder(png, { name: 'leaderboard.png' });
}

// Еженедельный автопост топа с изменением позиций относительно
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
        const attachment = await buildLeaderboardAttachment(client, withMovement, 'Топ активности за неделю');
        await channel.send({ files: [attachment] }).catch(() => {});

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

// Единая точка выдачи роли уровня — раньше жила прямо в commands/general/
// rep.js (только на пути /rep give), теперь level-up может прийти с трёх
// разных сторон (сообщение, голосовой sweep, /level set), поэтому логика
// централизована здесь, а не дублируется в каждом вызывающем месте. Роли
// уровней складываются (не отбираются при откате /level set) — то же
// поведение, что было у прежней системы репутации.
async function grantLevelRoleIfNeeded(guild, userId, levelIndex) {
    const roleId = await getLevelRoleId(guild.id, levelIndex);
    if (!roleId) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member || member.roles.cache.has(roleId)) return;
    await member.roles.add(roleId, 'Повышение уровня активности').catch(() => {});
}

// Публикует карточку level-up в announceChannelId гильдии (см.
// configureGuild) — в отличие от прежней /rep give, здесь нет
// interaction.channel под рукой (level-up может произойти в фоне, от
// голосового sweep), поэтому канал берётся из конфигурации фичи.
async function announceLevelUp(client, guildId, userId, levelIndex) {
    const guildCfg = await getGuildConfig(guildId);
    if (!guildCfg.announceChannelId) return;
    const channel =
        client.channels.cache.get(guildCfg.announceChannelId) ??
        (await client.channels.fetch(guildCfg.announceChannelId).catch(() => null));
    if (!channel) return;
    const { toMessage } = require('../utils/components');
    const level = LEVELS[levelIndex];
    await channel.send(toMessage(buildLevelUpCard(`<@${userId}>`, level))).catch(() => {});
}

// Вызывается из scripts/setup-leveling.js, чтобы предпочесть уже
// сохранённые announceChannelId/levelRoles поиску по имени — иначе
// переименованный вручную канал/роль уровня считался бы "не найденным"
// при следующем деплое и получал бы дубликат с дефолтным именем.
async function getGuildConfig(guildId) {
    const cfg = await config.load();
    return cfg.guilds[guildId] ?? {};
}

// Вызывается из scripts/setup-leveling.js — сохраняет канал для
// автопостов топа/level-up, категорию (общую с changelog/ и rules/, но
// у каждой фичи свой config-store) и карту "индекс уровня → роль",
// созданную скриптом. Отдельная функция, а не прямой config.update() из
// скрипта — scripts/ обращаются к фиче только через её публичный API
// (см. index.js).
async function configureGuild(guildId, { channelId, categoryId, levelRoles }) {
    await config.update(cfg => {
        const guildCfg = cfg.guilds[guildId] ?? {};
        if (channelId !== undefined) guildCfg.announceChannelId = channelId;
        if (categoryId !== undefined) guildCfg.categoryId = categoryId;
        if (levelRoles !== undefined) guildCfg.levelRoles = levelRoles;
        cfg.guilds[guildId] = guildCfg;
    });
}

module.exports = {
    LEVELS,
    POINTS_PER_MESSAGE,
    POINTS_PER_VOICE_MINUTE,
    MESSAGE_COOLDOWN_MS,
    getLevelIndex,
    getLevel,
    canCountMessage,
    buildLeaderboardMovement,
    addTextPoint,
    flushVoiceMinutes,
    getLeaderboard,
    getProfile,
    setScore,
    getLevelRoleId,
    grantLevelRoleIfNeeded,
    announceLevelUp,
    getGuildConfig,
    configureGuild,
    buildRankCardAttachment,
    buildLevelUpCard,
    buildLeaderboardAttachment,
    checkAndPostLeaderboard,
};
