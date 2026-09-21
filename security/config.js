const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'security-config';

const DEFAULTS = {
    logChannelId: null,
    trustedIds: [],
    trustedRoleId: null,
    // Память scripts/setup-roles.js для базовых ролей (Admin/Moderator/
    // Trusted) — отдельно от trustedRoleId (у которого есть собственный
    // функциональный смысл для isTrusted() ниже), чтобы повторный запуск
    // скрипта находил уже переименованную администратором роль по ID,
    // а не создавал рядом дубликат с дефолтным именем.
    baseRoleIds: {},
    // Родительский канал для приватных тредов-уведомлений о наказании
    // (utils/punishmentNotice.js) — провижинится
    // scripts/setup-punishment-notices.js.
    punishmentNoticeChannelId: null,
    bannedWords: [],
    antiNuke: { enabled: true, maxActions: 3, windowMs: 10000 },
    raidShield: {
        enabled: true,
        joinThreshold: 8,
        windowMs: 10000,
        lockdownMs: 10 * 60 * 1000,
        kickNewAccounts: true,
        newAccountAgeMs: 7 * 24 * 60 * 60 * 1000,
    },
    automod: { enabled: true, maxMentions: 5, maxMessagesPerWindow: 6, messageWindowMs: 5000 },
    auditLog: { enabled: true },
    verification: {
        enabled: false,
        unverifiedRoleId: null,
        verifiedRoleId: null,
        channelId: null,
        categoryId: null,
        // Минимальный возраст Discord-аккаунта для прохождения верификации —
        // самый дешёвый фильтр от рейд-ботов: их аккаунты почти всегда
        // созданы за минуты/часы до захода. Не блокирует навсегда: как
        // только аккаунт "дозреет", кнопка сама заработает (см.
        // verification.js).
        minAccountAgeMs: 24 * 60 * 60 * 1000,
        // Сколько неверных кодов капчи подряд (в течение captchaLockoutMs)
        // считается подозрительным поведением, а не обычной опечаткой —
        // после этого попытки временно блокируются и модерация получает
        // алерт в security-log.
        maxCaptchaAttempts: 3,
        captchaLockoutMs: 10 * 60 * 1000,
    },
    manualLockdown: { active: false, channelIds: [] },
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        baseRoleIds: { ...DEFAULTS.baseRoleIds, ...data.baseRoleIds },
        antiNuke: { ...DEFAULTS.antiNuke, ...data.antiNuke },
        raidShield: { ...DEFAULTS.raidShield, ...data.raidShield },
        automod: { ...DEFAULTS.automod, ...data.automod },
        auditLog: { ...DEFAULTS.auditLog, ...data.auditLog },
        verification: { ...DEFAULTS.verification, ...data.verification },
        manualLockdown: { ...DEFAULTS.manualLockdown, ...data.manualLockdown },
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

function getEnvTrustedIds() {
    return (process.env.TRUSTED_IDS ?? '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
}

async function isTrusted(guild, userId) {
    if (userId === guild.ownerId) return true;
    if (userId === guild.client.user.id) return true;
    const config = await store.load();
    if (config.trustedIds.includes(userId)) return true;
    if (getEnvTrustedIds().includes(userId)) return true;
    if (config.trustedRoleId) {
        const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
        if (member?.roles.cache.has(config.trustedRoleId)) return true;
    }
    return false;
}

module.exports = {
    load: store.load,
    save: store.save,
    update: store.update,
    isTrusted,
    getEnvTrustedIds,
    storeName: STORE_NAME,
};
