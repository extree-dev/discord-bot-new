// Уведомление о наказании. Личные сообщения бот больше не шлёт вообще
// (по решению администратора — единственный оставшийся канал ЛС теперь
// только /dm, вручную) — вместо этого заводит приватный тред с наказанным
// участником в отдельном канале (security/config.js
// punishmentNoticeChannelId, провижинится
// scripts/setup-punishment-notices.js) и пишет туда причину. Тред
// самоудаляется через NOTICE_TTL_MS — держать его вечно смысла нет,
// актуальный статус наказания и так виден staff в /dashboard и
// аудит-логе.
//
// БАНЫ — намеренное исключение. Личные сообщения работали для банов
// именно потому, что не требуют общего членства на сервере — тред
// требует. Забаненный участник перестаёт быть членом гильдии и теряет
// доступ вообще ко всем её каналам/тредам, включая тот, в который его
// добавили ДО бана (в отличие от ban.js/tickets/model.js, которые раньше
// звали sendPunishmentDm ДО guild.members.ban ровно по этой причине —
// после бана открыть ЛС ненадёжнее). Прочитать тред он всё равно не
// сможет никаким способом, поэтому notifyPunishment(..., {kind: 'ban'})
// просто ничего не делает.
const { ChannelType } = require('discord.js');
const { createStore } = require('./pgStore');
const securityConfig = require('../security/config');
const { baseContainer, textDisplay, toMessage } = require('./components');
const { COLORS, formatBody } = require('./embeds');

const STORE_NAME = 'punishment-notices';
const store = createStore(STORE_NAME, { threads: {} });

const NOTICE_TTL_MS = 24 * 60 * 60 * 1000;

const KIND_LABELS = {
    timeout: 'Мут',
    warn: 'Предупреждение',
};

async function notifyPunishment(target, guild, { kind, reason, durationLabel }) {
    if (kind === 'ban') return;
    const label = KIND_LABELS[kind] ?? kind;

    const config = await securityConfig.load();
    if (!config.punishmentNoticeChannelId) return;
    const parent =
        guild.channels.cache.get(config.punishmentNoticeChannelId) ??
        (await guild.channels.fetch(config.punishmentNoticeChannelId).catch(() => null));
    if (!parent) return;

    const thread = await parent.threads
        .create({
            name: `${label.toLowerCase()}-${target.username ?? target.tag ?? target.id}`.slice(0, 95).toLowerCase(),
            type: ChannelType.PrivateThread,
            invitable: false,
            reason: `Уведомление о наказании для ${target.tag ?? target.id}`,
        })
        .catch(() => null);
    if (!thread) return;
    await thread.members.add(target.id).catch(() => {});

    const card = baseContainer(COLORS.warning).addTextDisplayComponents(
        textDisplay(
            formatBody(
                label,
                [`**Причина:** ${reason || 'не указана'}`, durationLabel ? `**Срок:** ${durationLabel}` : null]
                    .filter(Boolean)
                    .join('\n')
            )
        )
    );
    await thread.send(toMessage(card)).catch(() => {});

    await store.update(data => {
        data.threads[thread.id] = { guildId: guild.id, deleteAt: Date.now() + NOTICE_TTL_MS };
    });
}

// Чистая функция — легко тестировать без реального стора/клиента
// Discord. Используется moderation/sweep.js (тот же тик, что уже
// проверяет истёкшие муты, — не нужен отдельный setInterval).
function findExpiredNoticeThreads(data, now) {
    return Object.entries(data.threads ?? {})
        .filter(([, t]) => now >= t.deleteAt)
        .map(([threadId, t]) => ({ threadId, guildId: t.guildId }));
}

async function sweepExpiredNoticeThreads(client) {
    const data = await store.load();
    const now = Date.now();
    for (const { threadId, guildId } of findExpiredNoticeThreads(data, now)) {
        const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
        const thread = guild
            ? (guild.channels.cache.get(threadId) ?? (await guild.channels.fetch(threadId).catch(() => null)))
            : null;
        await thread?.delete('Уведомление о наказании: истёк срок хранения').catch(() => {});
        await store.update(data2 => {
            delete data2.threads[threadId];
        });
    }
}

module.exports = { notifyPunishment, findExpiredNoticeThreads, sweepExpiredNoticeThreads };
