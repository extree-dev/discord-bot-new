// Мини дизайн-система embed'ов: единая цветовая палитра по смыслу и
// единый визуальный паттерн заголовок+описание для ВСЕХ сообщений бота —
// заголовок через "### " и краткое описание под ним через "-# "
// (официальный Discord subtext), а не через EmbedBuilder#setTitle —
// так весь бот выглядит цельно независимо от того, в каком файле
// создаётся сообщение. Конкретные embed'ы могут дозаполнять
// fields/footer/author — builder'ы возвращают обычный EmbedBuilder,
// а не готовый объект.
const { EmbedBuilder } = require('discord.js');

const COLORS = {
    primary: 0x5865f2,
    success: 0x57f287,
    warning: 0xfee75c,
    danger: 0xed4245,
    critical: 0x992d22,
    neutral: 0x99aab5,
};

function baseEmbed(color) {
    return new EmbedBuilder().setColor(color).setTimestamp();
}

// title — всегда "### заголовок". description — необязательный "-# текст"
// под ним; когда описания нет (например, у embed'а только с полями),
// остаётся один заголовок без подстроки.
function formatBody(title, description) {
    return description ? `### ${title}\n-# ${description}` : `### ${title}`;
}

function errorEmbed(description, title = 'Ошибка') {
    return baseEmbed(COLORS.danger).setDescription(formatBody(title, description));
}

function successEmbed(description, title = 'Готово') {
    return baseEmbed(COLORS.success).setDescription(formatBody(title, description));
}

function infoEmbed(description, title = 'Информация') {
    return baseEmbed(COLORS.primary).setDescription(formatBody(title, description));
}

function warningEmbed(description, title = 'Внимание') {
    return baseEmbed(COLORS.warning).setDescription(formatBody(title, description));
}

function criticalEmbed(description, title = 'Критично') {
    return baseEmbed(COLORS.critical).setDescription(formatBody(title, description));
}

function neutralEmbed(description, title) {
    return baseEmbed(COLORS.neutral).setDescription(title ? formatBody(title, description) : `-# ${description}`);
}

module.exports = {
    COLORS,
    baseEmbed,
    formatBody,
    errorEmbed,
    successEmbed,
    infoEmbed,
    warningEmbed,
    criticalEmbed,
    neutralEmbed,
};
