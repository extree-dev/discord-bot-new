// Автоматизация жизненного цикла тикетов — по прямому запросу
// администратора: ручное вмешательство модерации должно сводиться к
// минимуму. Один тик на оба независимых механизма (см. tickets/model.js
// findUnclaimedToEscalate/findIdleToWarn/findIdleToClose), тот же приём,
// что у moderation/sweep.js — не нужен отдельный setInterval под каждый.
const model = require('./model');
const config = require('./config');

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Бот обслуживает одну гильдию (GUILD_ID из .env) — тот же приём, что в
// presence/model.js resolveTemplate: явный GUILD_ID в приоритете, иначе
// первая гильдия в кэше (на случай, если переменная не задана локально).
function resolveGuild(client) {
    return process.env.GUILD_ID ? client.guilds.cache.get(process.env.GUILD_ID) : client.guilds.cache.first();
}

async function getManagementChannel(guild, cfg) {
    if (!cfg.managementChannelId) return null;
    return (
        guild.channels.cache.get(cfg.managementChannelId) ??
        (await guild.channels.fetch(cfg.managementChannelId).catch(() => null))
    );
}

async function fetchThread(guild, threadId) {
    return guild.channels.cache.get(threadId) ?? (await guild.channels.fetch(threadId).catch(() => null));
}

async function sweepUnclaimed(guild, cfg, now) {
    const toEscalate = model.findUnclaimedToEscalate(cfg.ticketsById, now);
    if (!toEscalate.length) return;
    const channel = await getManagementChannel(guild, cfg);
    if (!channel) return;

    const mentionLine = [cfg.supportRoleId, cfg.betaSupportRoleId]
        .filter(Boolean)
        .map(id => `<@&${id}>`)
        .join(' ');

    for (const { threadId, number } of toEscalate) {
        await channel.send(model.buildUnclaimedEscalationMessage(number, mentionLine)).catch(() => {});
        await model.markTicketEscalated(threadId);
    }
}

async function sweepIdleWarn(guild, cfg, now) {
    for (const { threadId } of model.findIdleToWarn(cfg.ticketsById, now)) {
        const thread = await fetchThread(guild, threadId);
        if (thread) await thread.send(model.buildIdleWarnMessage()).catch(() => {});
        await model.markTicketIdleWarned(threadId);
    }
}

async function sweepIdleClose(guild, cfg, now) {
    for (const { threadId, authorId } of model.findIdleToClose(cfg.ticketsById, now)) {
        const thread = await fetchThread(guild, threadId);
        if (thread) {
            await thread.send(model.buildIdleCloseMessage()).catch(() => {});
            await model.closeReport(thread, authorId);
        } else {
            // Тред удалили вручную, пока ждали IDLE_CLOSE_MS — просто
            // убираем зависшую запись, иначе findIdleToClose находила бы
            // её на каждом следующем тике без возможности когда-либо
            // закрыть.
            await config.update(c => {
                delete c.ticketsById[threadId];
            });
        }
    }
}

async function runOnce(client) {
    const guild = resolveGuild(client);
    if (!guild) return;
    const cfg = await config.load();
    const now = Date.now();
    await sweepUnclaimed(guild, cfg, now);
    await sweepIdleWarn(guild, cfg, now);
    await sweepIdleClose(guild, cfg, now);
}

function start(client) {
    setInterval(() => {
        runOnce(client).catch(err => console.error('tickets sweep:', err));
    }, SWEEP_INTERVAL_MS);
}

module.exports = { start, runOnce };
