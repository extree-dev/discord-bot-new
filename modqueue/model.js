// Очередь модерации сообщений: в каналах из moderatedChannelIds
// сообщение участника сразу удаляется и уходит карточкой на канал
// проверки — публикуется только после того, как модератор нажмёт
// "Одобрить". Заявки на проверке хранятся в памяти процесса, а не в БД
// (тот же компромисс, что у leveling/model.js messageCooldowns) —
// проверка происходит быстро, а не держать вечно; при перезапуске бота
// уже поданные, но ещё не рассмотренные заявки теряются (кнопки на уже
// отправленных карточках после этого отвечают "заявка недоступна", а не
// падают молча).
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, formatBody } = require('../utils/embeds');
const { baseContainer, textDisplay, toMessage, successContainer, errorContainer } = require('../utils/components');

const APPROVE_PREFIX = 'modqueue_approve:';
const REJECT_PREFIX = 'modqueue_reject:';

// Не больше 4 вложений на пересылку и не крупнее 8МБ каждое — вложения
// скачиваются в память процесса целиком перед пересылкой (буфер, не
// поток), без верхней границы один участник с десятком тяжёлых файлов
// мог бы ощутимо нагрузить память бота на каждое проверяемое сообщение.
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const CONTENT_PREVIEW_MAX_CHARS = 1500;

const pending = new Map();

function truncate(text, maxChars) {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 1)}…`;
}

function isModerated(moderatedChannelIds, channelId) {
    return moderatedChannelIds.includes(channelId);
}

function addModeratedChannel(moderatedChannelIds, channelId) {
    if (moderatedChannelIds.includes(channelId)) return moderatedChannelIds;
    return [...moderatedChannelIds, channelId];
}

function removeModeratedChannel(moderatedChannelIds, channelId) {
    return moderatedChannelIds.filter(id => id !== channelId);
}

async function fetchAttachmentBuffer(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
}

function buildReviewCard({ authorId, authorTag, channelId, content, attachedCount, skippedCount }) {
    const preview = content ? truncate(content, CONTENT_PREVIEW_MAX_CHARS) : '*(сообщение без текста)*';
    const lines = [
        `**Автор:** <@${authorId}> (${authorTag})`,
        `**Канал:** <#${channelId}>`,
        attachedCount > 0 ? `Вложений на публикацию: ${attachedCount}` : null,
        skippedCount > 0 ? `⚠ Не сохранено вложений: ${skippedCount} (слишком большие или не скачались)` : null,
    ].filter(Boolean);

    return baseContainer(COLORS.warning)
        .addTextDisplayComponents(textDisplay(formatBody('Сообщение на проверке', lines.join('\n'))))
        .addTextDisplayComponents(textDisplay(preview));
}

function buildReviewButtons(pendingId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${APPROVE_PREFIX}${pendingId}`)
            .setLabel('Одобрить')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${REJECT_PREFIX}${pendingId}`)
            .setLabel('Отклонить')
            .setStyle(ButtonStyle.Secondary)
    );
}

// Сообщение удаляется сразу (модерация "по умолчанию скрыто", а не
// "видно, пока не отклонят") — вложения скачиваются ДО удаления, пока
// их CDN-ссылки ещё привязаны к живому сообщению и гарантированно
// работают.
async function submitForReview(message, reviewChannel) {
    const allAttachments = [...message.attachments.values()];
    const toDownload = allAttachments.slice(0, MAX_ATTACHMENTS);
    let skippedCount = Math.max(0, allAttachments.length - MAX_ATTACHMENTS);

    const files = [];
    for (const attachment of toDownload) {
        if (attachment.size > MAX_ATTACHMENT_BYTES) {
            skippedCount++;
            continue;
        }
        const buffer = await fetchAttachmentBuffer(attachment.url);
        if (!buffer) {
            skippedCount++;
            continue;
        }
        files.push({ name: attachment.name, buffer });
    }

    await message.delete().catch(() => {});

    const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pending.set(pendingId, {
        guildId: message.guild.id,
        channelId: message.channel.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        authorDisplayName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
        content: message.content,
        files,
    });

    const card = buildReviewCard({
        authorId: message.author.id,
        authorTag: message.author.tag,
        channelId: message.channel.id,
        content: message.content,
        attachedCount: files.length,
        skippedCount,
    });
    await reviewChannel.send(toMessage(card, buildReviewButtons(pendingId))).catch(() => {});
}

// Публикует сообщение от лица бота (не вебхуком под видом участника —
// не требует отдельного права ManageWebhooks, которого может не быть у
// бота на живом сервере) с упоминанием автора по имени БЕЗ пинга
// (жирным текстом, не <@id> — иначе публикация собственного одобренного
// сообщения присылала бы участнику уведомление на ровном месте).
async function approvePost(client, pendingId) {
    const item = pending.get(pendingId);
    if (!item) return { error: 'expired' };
    pending.delete(pendingId);

    const channel =
        client.channels.cache.get(item.channelId) ?? (await client.channels.fetch(item.channelId).catch(() => null));
    if (!channel) return { error: 'channel-gone', item };

    const files = item.files.map(f => new AttachmentBuilder(f.buffer, { name: f.name }));
    const content = item.content
        ? `**${item.authorDisplayName}:** ${item.content}`
        : `**${item.authorDisplayName}** отправил(а) вложение:`;
    await channel.send({ content, files }).catch(() => {});
    return { ok: true, item };
}

function rejectPost(pendingId) {
    const item = pending.get(pendingId);
    if (!item) return { error: 'expired' };
    pending.delete(pendingId);
    return { ok: true, item };
}

function buildOutcomeCard(kind, { authorId, moderator }) {
    if (kind === 'approved') {
        return successContainer(`Сообщение от <@${authorId}> одобрено и опубликовано — ${moderator}.`, 'Одобрено');
    }
    if (kind === 'rejected') {
        return errorContainer(`Сообщение от <@${authorId}> отклонено — ${moderator}.`, 'Отклонено');
    }
    return errorContainer(
        'Эта заявка больше не действительна (например, бот перезапускался) — действий нет.',
        'Заявка недоступна'
    );
}

module.exports = {
    MAX_ATTACHMENTS,
    MAX_ATTACHMENT_BYTES,
    APPROVE_PREFIX,
    REJECT_PREFIX,
    isModerated,
    addModeratedChannel,
    removeModeratedChannel,
    buildReviewCard,
    buildReviewButtons,
    buildOutcomeCard,
    submitForReview,
    approvePost,
    rejectPost,
};
