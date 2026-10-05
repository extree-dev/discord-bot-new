const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const tickets = require('../../tickets');

// Правый клик на сообщении → "Приложения" → "Пожаловаться на сообщение" —
// открывает ТУ ЖЕ модалку, что кнопка "Жалоба на игрока" в #открыть-тикет
// (tickets.buildReportModal, тот же CREATE_MODAL_ID), просто с уже
// заполненными полями: автор сообщения и ссылка на него + начало текста.
// Дальше обработка идёт по уже существующему пути (tickets/handlers.js
// handleModalSubmit) без единой новой строчки там — сюда новый код не
// нужен, поля просто уже не пустые при открытии.
module.exports = {
    data: new ContextMenuCommandBuilder().setName('Пожаловаться на сообщение').setType(ApplicationCommandType.Message),

    async execute(interaction) {
        const message = interaction.targetMessage;
        const description = `Сообщение: ${message.url}\n\n${message.content ?? ''}`.trim().slice(0, 1000);

        await interaction.showModal(
            tickets.buildReportModal({
                target: `<@${message.author.id}>`,
                description,
            })
        );
    },
};
