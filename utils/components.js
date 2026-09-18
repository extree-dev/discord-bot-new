// Мини дизайн-система на Discord Components V2 (Container/TextDisplay/
// Separator) — аналог utils/embeds.js, но для сообщений, которым нужен
// вид "приложения", а не классический embed. Сообщение с флагом
// MessageFlags.IsComponentsV2 не может содержать content/embeds — весь
// текст идёт через TextDisplay, поэтому toMessage() ниже — единственный
// способ собрать итоговый payload для send()/reply()/edit().
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');
const { COLORS, formatBody } = require('./embeds');

function baseContainer(color) {
    return new ContainerBuilder().setAccentColor(color);
}

function textDisplay(content) {
    return new TextDisplayBuilder().setContent(content);
}

function separator(spacing = SeparatorSpacingSize.Small) {
    return new SeparatorBuilder().setSpacing(spacing);
}

// Контейнер из одного блока "### заголовок\n-# описание" — прямой аналог
// baseEmbed(color).setDescription(formatBody(title, description)).
function messageContainer(color, title, description) {
    return baseContainer(color).addTextDisplayComponents(textDisplay(formatBody(title, description)));
}

function errorContainer(description, title = 'Ошибка') {
    return messageContainer(COLORS.danger, title, description);
}

function successContainer(description, title = 'Готово') {
    return messageContainer(COLORS.success, title, description);
}

function infoContainer(description, title = 'Информация') {
    return messageContainer(COLORS.primary, title, description);
}

function warningContainer(description, title = 'Внимание') {
    return messageContainer(COLORS.warning, title, description);
}

// Готовый payload {flags, components} для send()/reply()/editReply() —
// принимает один или несколько top-level компонентов (Container,
// ActionRow, ...) в нужном порядке.
function toMessage(...components) {
    return { flags: MessageFlags.IsComponentsV2, components };
}

module.exports = {
    baseContainer,
    textDisplay,
    separator,
    messageContainer,
    errorContainer,
    successContainer,
    infoContainer,
    warningContainer,
    toMessage,
};
