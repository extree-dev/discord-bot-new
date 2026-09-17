// Роутинг Discord-взаимодействий системы предложений: кнопка открытия
// формы и сабмит модалки — через карты customId -> обработчик, вся
// доменная работа делегирована в suggestions/model.js.
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const model = require('./model');

const SUGGESTION_MODAL_ID = 'suggestion_modal';
const TITLE_INPUT_ID = 'suggestion_title_input';
const DESCRIPTION_INPUT_ID = 'suggestion_description_input';

async function handleOpenButton(interaction) {
    const modal = new ModalBuilder().setCustomId(SUGGESTION_MODAL_ID).setTitle('Предложить идею');

    const titleInput = new TextInputBuilder()
        .setCustomId(TITLE_INPUT_ID)
        .setLabel('Коротко, о чём идея')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId(DESCRIPTION_INPUT_ID)
        .setLabel('Расскажи подробнее')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput)
    );

    await interaction.showModal(modal);
}

const BUTTON_HANDLERS = { suggestion_open: handleOpenButton };

async function handleButton(interaction) {
    const handler = BUTTON_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
}

async function handleSuggestionModal(interaction) {
    const title = interaction.fields.getTextInputValue(TITLE_INPUT_ID).trim();
    const description = interaction.fields.getTextInputValue(DESCRIPTION_INPUT_ID).trim();

    const result = await model.createSuggestion(interaction, { title, description });

    if (result.error) {
        await interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
        return;
    }

    await interaction.reply({
        embeds: [
            successEmbed(
                `Спасибо! Предложение **#${result.number}** опубликовано и ждёт рассмотрения.`,
                'Предложение отправлено'
            ),
        ],
        ephemeral: true,
    });
}

const MODAL_HANDLERS = { [SUGGESTION_MODAL_ID]: handleSuggestionModal };

async function handleModalSubmit(interaction) {
    const handler = MODAL_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
}

function register() {}

module.exports = { register, handleButton, handleModalSubmit };
