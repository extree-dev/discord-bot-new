// Очередь предложений по каналу: любое сообщение участника в
// отслеживаемом канале (config.channelId) сразу удаляется и уходит
// карточкой в отдельный staff-only канал (config.reviewChannelId) на
// проверку — публикуется обратно в исходный канал уже оформленной
// карточкой-предложением, только если модератор одобрит. Отклонённое
// предложение исчезает без следа: ни автору, ни в канал ничего не
// приходит. Антиспам — не собственный кулдаун, а нативный Discord
// slowmode на канале (см. scripts/setup-idea-queue.js), поэтому здесь
// его отслеживать не нужно.
//
// Заявки на проверке хранятся в памяти процесса, а не в БД — тот же
// компромисс, что и у modqueue/model.js: живут недолго (пока их не
// рассмотрят), тащить в БД не стоит; при перезапуске бота уже поданные,
// но ещё не рассмотренные заявки теряются, их карточки после этого
// отвечают "заявка недоступна" вместо попытки опубликовать пустоту.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, formatBody } = require('../utils/embeds');
const {
    baseContainer,
    textDisplay,
    separator,
    toMessage,
    successContainer,
    errorContainer,
} = require('../utils/components');

const APPROVE_PREFIX = 'idea_approve:';
const REJECT_PREFIX = 'idea_reject:';
const CONTENT_PREVIEW_MAX_CHARS = 1500;

const pending = new Map();

function truncate(text, maxChars) {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 1)}…`;
}

function buildReviewCard({ authorId, authorTag, content }) {
    const preview = content ? truncate(content, CONTENT_PREVIEW_MAX_CHARS) : '*(сообщение без текста)*';
    return baseContainer(COLORS.warning)
        .addTextDisplayComponents(
            textDisplay(formatBody('Предложение на проверке', `**Автор:** <@${authorId}> (${authorTag})`))
        )
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

// Сообщение удаляется сразу — модерация "по умолчанию скрыто", то же
// решение, что и у modqueue.
async function submitForReview(message, reviewChannel) {
    await message.delete().catch(() => {});

    const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pending.set(pendingId, {
        channelId: message.channel.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        authorDisplayName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
        content: message.content,
    });

    const card = buildReviewCard({
        authorId: message.author.id,
        authorTag: message.author.tag,
        content: message.content,
    });
    await reviewChannel.send(toMessage(card, buildReviewButtons(pendingId))).catch(() => {});
}

// Публикуется обратно в исходный канал как оформленная карточка-
// предложение — НЕ пересылает сообщение как есть (в отличие от
// modqueue.approvePost): это витрина идей по конкретному каналу, а не лог
// одобренных сообщений. Имя автора — жирным текстом, не <@id> (то же
// решение, что у modqueue и tickets.formatReportedUser: публикация
// собственного одобренного предложения не должна слать автору
// уведомление на ровном месте).
function buildApprovedCard({ authorDisplayName, content }) {
    return baseContainer(COLORS.primary)
        .addTextDisplayComponents(
            textDisplay(formatBody('Что нового хотите видеть на этом канале?', `Предложил(а) **${authorDisplayName}**`))
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(textDisplay(content || '*(сообщение без текста)*'));
}

async function approvePost(client, pendingId) {
    const item = pending.get(pendingId);
    if (!item) return { error: 'expired' };
    pending.delete(pendingId);

    const channel =
        client.channels.cache.get(item.channelId) ?? (await client.channels.fetch(item.channelId).catch(() => null));
    if (!channel) return { error: 'channel-gone', item };

    await channel.send(toMessage(buildApprovedCard(item))).catch(() => {});
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
        return successContainer(`Предложение от <@${authorId}> одобрено и опубликовано — ${moderator}.`, 'Одобрено');
    }
    if (kind === 'rejected') {
        return errorContainer(`Предложение от <@${authorId}> отклонено — ${moderator}.`, 'Отклонено');
    }
    return errorContainer(
        'Эта заявка больше не действительна (например, бот перезапускался) — действий нет.',
        'Заявка недоступна'
    );
}

module.exports = {
    APPROVE_PREFIX,
    REJECT_PREFIX,
    buildReviewCard,
    buildReviewButtons,
    buildApprovedCard,
    buildOutcomeCard,
    submitForReview,
    approvePost,
    rejectPost,
};
