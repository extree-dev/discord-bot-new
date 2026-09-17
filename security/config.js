const path = require('path');
const { createStore } = require('../utils/jsonStore');

const filePath = path.join(__dirname, '..', 'data', 'security-config.json');

const DEFAULTS = {
    logChannelId: null,
    trustedIds: [],
    trustedRoleId: null,
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
    verification: { enabled: false, unverifiedRoleId: null, verifiedRoleId: null, channelId: null },
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        antiNuke: { ...DEFAULTS.antiNuke, ...data.antiNuke },
        raidShield: { ...DEFAULTS.raidShield, ...data.raidShield },
        automod: { ...DEFAULTS.automod, ...data.automod },
        auditLog: { ...DEFAULTS.auditLog, ...data.auditLog },
        verification: { ...DEFAULTS.verification, ...data.verification },
    };
}

const store = createStore(filePath, DEFAULTS, normalize);

function getEnvTrustedIds() {
    return (process.env.TRUSTED_IDS ?? '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
}

async function isTrusted(guild, userId) {
    if (userId === guild.ownerId) return true;
    if (userId === guild.client.user.id) return true;
    const config = store.load();
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
    filePath,
};
