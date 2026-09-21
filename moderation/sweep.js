// Периодическая проверка кастомных мутов: снимает роль Muted, у кого
// истёк срок. Короче интервал, чем у tickets/sweep.js (5 мин) — мут
// может быть коротким (10 мин, см. ticket punish menu), и 5-минутный
// разброс там заметнее. Заодно, на том же тике — тредов-уведомлений о
// наказании (utils/punishmentNotice.js), которым пора самоудалиться:
// отдельный setInterval под это не нужен.
const model = require('./model');
const punishmentNotice = require('../utils/punishmentNotice');

const SWEEP_INTERVAL_MS = 60 * 1000;

async function runOnce(client) {
    const data = await model.load();
    const now = Date.now();

    for (const { guildId, userId } of model.findExpiredMutes(data, now)) {
        const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
        if (!guild) continue;
        await model.unmuteMember(guild, userId, { auto: true }).catch(err => console.error('moderation sweep:', err));
    }

    await punishmentNotice.sweepExpiredNoticeThreads(client).catch(err => console.error('moderation sweep:', err));
}

function start(client) {
    setInterval(() => {
        runOnce(client).catch(err => console.error('moderation sweep:', err));
    }, SWEEP_INTERVAL_MS);
}

module.exports = { start, runOnce };
