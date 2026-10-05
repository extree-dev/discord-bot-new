const { createStore } = require('./pgStore');

const STORE_NAME = 'warnings';

// Предупреждения старше этого срока не считаются активными: не входят в
// счётчик, по которому security/escalation.js решает про тайм-аут/бан, и
// помечаются как истёкшие в /warnings. Без этого у участника, который не
// нарушал год, бессрочно висело бы "дело" из старых варнов, которое
// всплыло бы баном за одно мелкое нарушение сейчас. Полная история никуда
// не девается — getWarnings() её не фильтрует, decay влияет только на
// getActiveWarnings()/isExpired().
const WARNING_DECAY_MS = 30 * 24 * 60 * 60 * 1000;

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

function isExpired(warning, now = Date.now()) {
    return now - new Date(warning.date).getTime() > WARNING_DECAY_MS;
}

// То же, что getWarnings(), но без предупреждений старше WARNING_DECAY_MS —
// на этот список (не на полную историю) должна опираться любая логика,
// принимающая решение о наказании по накопленным варнам.
async function getActiveWarnings(guildId, userId) {
    const all = await getWarnings(guildId, userId);
    const now = Date.now();
    return all.filter(w => !isExpired(w, now));
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

module.exports = {
    addWarning,
    getWarnings,
    getActiveWarnings,
    clearWarnings,
    getWarningStats,
    isExpired,
    WARNING_DECAY_MS,
    storeName: STORE_NAME,
};
