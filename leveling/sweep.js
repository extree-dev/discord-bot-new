// Раз в минуту начисляет по минуте очков всем, кто прямо сейчас в
// засчитываемом голосовом канале (см. handlers.js activeVoice) — одной
// батч-транзакцией на всех разом (model.flushVoiceMinutes), а не по
// одной на каждого.
const model = require('./model');
const handlers = require('./handlers');

const SWEEP_INTERVAL_MS = 60 * 1000;

async function runOnce(client) {
    const entries = handlers.getActiveVoiceEntries();
    if (!entries.length) return;

    const results = await model.flushVoiceMinutes(entries.map(e => ({ ...e, minutes: 1 })));
    for (const result of results) {
        if (!result.leveledUp) continue;
        const guild =
            client.guilds.cache.get(result.guildId) ?? (await client.guilds.fetch(result.guildId).catch(() => null));
        if (!guild) continue;
        await handlers.applyLevelUp(client, guild, result.userId, result.levelIndex);
    }
}

function start(client) {
    setInterval(() => {
        runOnce(client).catch(err => console.error('leveling sweep:', err));
    }, SWEEP_INTERVAL_MS);
}

module.exports = { start, runOnce };
