const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Отправка личного сообщения, которое само удаляется через некоторое
// время — чтобы не засорять переписку с пользователем в личных
// сообщениях навсегда (по просьбе администратора: DM ephemeral не
// бывают, этот флаг Discord работает только для ответов на interaction в
// гильдии, поэтому для обычных DM единственная альтернатива — реальное
// удаление сообщения по таймеру). Таймер держится в памяти процесса, а
// не в БД — если бот перезапустится раньше срока (например, из-за
// деплоя), это сообщение просто не удалится автоматически; для чисто
// информационных напоминаний это приемлемый компромисс, не стоящий
// отдельного стора и sweep-обхода ради самого по себе UX-нюанса.
async function sendSelfDeletingDm(user, payload, delayMs) {
    const message = await user.send(payload).catch(() => null);
    if (!message) return null;
    setTimeout(() => {
        message.delete().catch(() => {});
    }, delayMs);
    return message;
}

const CLEAR_HISTORY_BUTTON_CUSTOM_ID = 'dm_clear_history';

function buildClearHistoryButtonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(CLEAR_HISTORY_BUTTON_CUSTOM_ID)
            .setLabel('Очистить историю')
            .setStyle(ButtonStyle.Secondary)
    );
}

// Удаляет в личке с пользователем ТОЛЬКО сообщения самого бота — у бота
// нет и не может быть права "Manage Messages" на чужие сообщения в DM
// (в личных сообщениях этого понятия вообще нет, каждая сторона может
// удалять только свои же сообщения — ограничение платформы, не бота).
// DMChannel также не поддерживает bulkDelete() (это метод только
// обычных текстовых каналов гильдии), поэтому удаляем по одному.
// Используется и кнопкой "Очистить историю" в самих DM (handleClearHistoryButton
// ниже), и админ-командой /dm-clear (commands/moderation/dm-clear.js).
async function clearBotDmHistory(client, userId) {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return { error: 'Пользователь не найден.' };
    const dmChannel = await user.createDM().catch(() => null);
    if (!dmChannel) return { error: 'Не удалось открыть личные сообщения с этим пользователем.' };

    let deleted = 0;
    let before;
    for (;;) {
        const batch = await dmChannel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
        if (!batch || batch.size === 0) break;
        for (const message of batch.values()) {
            if (message.author.id === client.user.id) {
                await message.delete().catch(() => {});
                deleted += 1;
            }
        }
        before = batch.last()?.id;
        if (batch.size < 100) break;
    }
    return { deleted };
}

async function handleClearHistoryButton(interaction) {
    if (interaction.customId !== CLEAR_HISTORY_BUTTON_CUSTOM_ID) return false;
    await interaction.deferReply();
    const result = await clearBotDmHistory(interaction.client, interaction.user.id);
    await interaction
        .editReply(
            result.error
                ? result.error
                : result.deleted
                  ? `Удалено сообщений бота: ${result.deleted}.`
                  : 'Нечего удалять — сообщений бота в этой переписке нет.'
        )
        .catch(() => {});
    return true;
}

module.exports = {
    sendSelfDeletingDm,
    CLEAR_HISTORY_BUTTON_CUSTOM_ID,
    buildClearHistoryButtonRow,
    clearBotDmHistory,
    handleClearHistoryButton,
};
