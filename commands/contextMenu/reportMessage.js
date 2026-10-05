const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const tickets = require('../../tickets');

// Правый клик на сообщении → "Приложения" → "Пожаловаться на сообщение" —
// та же форма (два поля), что кнопка "Жалоба на игрока" в #открыть-тикет
// (tickets.buildReportModal), с уже заполненными полями: автор сообщения
// и ссылка на него + начало текста. kind: 'message' переключает модалку
// на свой customId (CREATE_MODAL_MESSAGE_ID) — tickets/handlers.js
// handleModalSubmit по нему узнаёт тип жалобы и прокидывает его в
// submitReport(), которая подписывает карточку тикета (в треде и в
// канале управления) как "Жалоба на сообщение", а не "Жалоба на игрока" —
// иначе два разных по смыслу тикета выглядели бы одинаково.
module.exports = {
    data: new ContextMenuCommandBuilder().setName('Пожаловаться на сообщение').setType(ApplicationCommandType.Message),

    async execute(interaction) {
        const message = interaction.targetMessage;
        const description = `Сообщение: ${message.url}\n\n${message.content ?? ''}`.trim().slice(0, 1000);

        await interaction.showModal(
            tickets.buildReportModal({
                kind: 'message',
                target: `<@${message.author.id}>`,
                description,
            })
        );
    },
};
