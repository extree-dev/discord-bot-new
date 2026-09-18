const { createStore } = require('./pgStore');

const STORE_NAME = 'warnings';

// Одна JSONB-строка на весь сервер-бот: { "guildId_userId": [ {...}, ... ] }.
const store = createStore(STORE_NAME, {});

async function addWarning(guildId, userId, reason, moderatorTag) {
    const key = `${guildId}_${userId}`;
    // update(), а не load()+save(): без этого два предупреждения одному
    // пользователю, выданных почти одновременно (например, automod и
    // модератор вручную), могли бы затереть друг друга.
    return store.update(data => {
        if (!data[key]) data[key] = [];
        data[key].push({ reason, moderatorTag, date: new Date().toISOString() });
        return data[key];
    });
}

async function getWarnings(guildId, userId) {
    const data = await store.load();
    return data[`${guildId}_${userId}`] ?? [];
}

async function clearWarnings(guildId, userId) {
    const key = `${guildId}_${userId}`;
    await store.update(data => {
        delete data[key];
    });
}

// Сводка для /dashboard: сколько разных пользователей сейчас имеют хотя
// бы одно предупреждение и сколько предупреждений выдано всего.
async function getWarningStats() {
    const data = await store.load();
    const entries = Object.values(data).filter(list => Array.isArray(list) && list.length > 0);
    const totalWarnings = entries.reduce((sum, list) => sum + list.length, 0);
    return { warnedUsers: entries.length, totalWarnings };
}

module.exports = { addWarning, getWarnings, clearWarnings, getWarningStats, storeName: STORE_NAME };
