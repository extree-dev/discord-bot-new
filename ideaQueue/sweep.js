// Напоминание модерации о зависших заявках — по решению администратора
// 100%-я ручная проверка каждой идеи остаётся (авто-публикация не
// внедряется), поэтому единственная безопасная автоматизация здесь —
// не дать забытой заявке молча лежать: раз в SWEEP_INTERVAL_MS проверяем,
// есть ли заявки старше REMIND_THRESHOLD_MS без решения, и шлём ОДНО
// сводное напоминание в канал проверки (см. model.js
// findStaleReviewItems/markReviewItemsReminded — без этого флага
// напоминание повторялось бы на каждом тике).
const config = require('./config');
const model = require('./model');

const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

async function runOnce(client) {
    const now = Date.now();
    const stale = model.findStaleReviewItems(now);
    if (!stale.length) return;

    const cfg = await config.load();
    if (!cfg.reviewChannelId) return;

    const guild = process.env.GUILD_ID ? client.guilds.cache.get(process.env.GUILD_ID) : client.guilds.cache.first();
    if (!guild) return;
    const channel =
        guild.channels.cache.get(cfg.reviewChannelId) ??
        (await guild.channels.fetch(cfg.reviewChannelId).catch(() => null));
    if (!channel) return;

    const oldestCreatedAt = Math.min(...stale.map(s => s.createdAt));
    await channel.send(model.buildStaleReminderMessage(stale.length, oldestCreatedAt, now)).catch(() => {});
    model.markReviewItemsReminded(stale.map(s => s.pendingId));
}

function start(client) {
    setInterval(() => {
        runOnce(client).catch(err => console.error('ideaQueue sweep:', err));
    }, SWEEP_INTERVAL_MS);
}

module.exports = { start, runOnce };
