// Мини дизайн-система embed'ов: единая цветовая палитра по смыслу и
// готовые builder'ы с одинаковым базовым видом (цвет + timestamp), чтобы
// весь бот выглядел цельно независимо от того, в каком файле создаётся
// сообщение. Конкретные embed'ы могут дозаполнять title/fields/footer —
// builder'ы возвращают обычный EmbedBuilder, а не готовый объект.
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

function errorEmbed(description, title = 'Ошибка') {
    return baseEmbed(COLORS.danger).setTitle(title).setDescription(description);
}

function successEmbed(description, title = 'Готово') {
    return baseEmbed(COLORS.success).setTitle(title).setDescription(description);
}

function infoEmbed(description, title = 'Информация') {
    return baseEmbed(COLORS.primary).setTitle(title).setDescription(description);
}

function warningEmbed(description, title = 'Внимание') {
    return baseEmbed(COLORS.warning).setTitle(title).setDescription(description);
}

function criticalEmbed(description, title = 'Критично') {
    return baseEmbed(COLORS.critical).setTitle(title).setDescription(description);
}

function neutralEmbed(description, title) {
    const embed = baseEmbed(COLORS.neutral).setDescription(description);
    return title ? embed.setTitle(title) : embed;
}

module.exports = {
    COLORS,
    baseEmbed,
    errorEmbed,
    successEmbed,
    infoEmbed,
    warningEmbed,
    criticalEmbed,
    neutralEmbed,
};
