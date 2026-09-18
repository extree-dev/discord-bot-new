// Периодическая проверка тикетов: эскалация непринятых обращений и
// предупреждение/автозакрытие тех, где давно никто не отвечал. Чистые
// предикаты (findTicketsToEscalate/Warn/AutoClose) живут в model.js —
// здесь только побочные эффекты Discord (сообщения, закрытие) и таймер.
const { load } = require('./config');
const { warningEmbed } = require('../utils/embeds');
const model = require('./model');

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

async function fetchThread(client, threadId) {
    return client.channels.cache.get(threadId) ?? (await client.channels.fetch(threadId).catch(() => null));
}

async function runOnce(client) {
    const config = await load();
    const now = Date.now();

    for (const [threadId, entry] of model.findTicketsToEscalate(config, now)) {
        const thread = await fetchThread(client, threadId);
        await model.markEscalated(threadId);
        if (!thread) continue;

        const roleId = config.escalationRoleId ?? config.supportRoleId;
        await thread
            .send({
                content: roleId ? `<@&${roleId}>` : undefined,
                embeds: [
                    warningEmbed(
                        `Тикет #${entry.number} не взят в работу уже ${model.formatDuration(now - entry.createdAt)}.`,
                        'Эскалация'
                    ),
                ],
            })
            .catch(() => {});
    }

    for (const [threadId, entry] of model.findTicketsToWarn(config, now)) {
        const thread = await fetchThread(client, threadId);
        await model.markWarned(threadId);
        if (!thread) continue;

        await thread
            .send({
                embeds: [
                    warningEmbed(
                        `В тикете #${entry.number} нет активности. Если вопрос решён — закройте тикет; иначе он ` +
                            `закроется автоматически через ${model.formatDuration(config.inactivityCloseMs)}.`,
                        'Тикет неактивен'
                    ),
                ],
            })
            .catch(() => {});
    }

    for (const [threadId, entry] of model.findTicketsToRemindOwner(config, now)) {
        await model.markOwnerNotified(threadId);
        await model.sendOwnerReminder(client, entry, threadId).catch(() => {});
    }

    for (const [threadId, entry] of model.findTicketsToAutoClose(config, now)) {
        const thread = await fetchThread(client, threadId);
        if (!thread) continue;
        const guild = thread.guild ?? (entry.guildId ? client.guilds.cache.get(entry.guildId) : null);
        if (!guild) continue;

        await model.closeTicket(guild, thread, entry, null).catch(err => console.error('tickets sweep close:', err));
        await model.sendRatingRequest(client, entry, threadId).catch(() => {});
    }
}

function start(client) {
    setInterval(() => {
        runOnce(client).catch(err => console.error('tickets sweep:', err));
    }, SWEEP_INTERVAL_MS);
}

module.exports = { start, runOnce };
