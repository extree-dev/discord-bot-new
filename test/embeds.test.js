const test = require('node:test');
const assert = require('node:assert/strict');
const {
    COLORS,
    formatBody,
    errorEmbed,
    successEmbed,
    infoEmbed,
    warningEmbed,
    criticalEmbed,
    neutralEmbed,
} = require('../utils/embeds');

test('formatBody собирает заголовок как "### " и описание как "-# "', () => {
    assert.equal(formatBody('Заголовок', 'Текст'), '### Заголовок\n-# Текст');
    assert.equal(formatBody('Заголовок'), '### Заголовок');
});

test('errorEmbed собирает embed цвета danger с заголовком по умолчанию и переданным текстом', () => {
    const embed = errorEmbed('Что-то пошло не так').toJSON();
    assert.equal(embed.title, undefined);
    assert.equal(embed.description, '### Ошибка\n-# Что-то пошло не так');
    assert.equal(embed.color, COLORS.danger);
    assert.ok(embed.timestamp);
});

test('successEmbed/infoEmbed/warningEmbed/criticalEmbed используют цвета из единой палитры', () => {
    assert.equal(successEmbed('ok').toJSON().color, COLORS.success);
    assert.equal(infoEmbed('ok').toJSON().color, COLORS.primary);
    assert.equal(warningEmbed('ok').toJSON().color, COLORS.warning);
    assert.equal(criticalEmbed('ok').toJSON().color, COLORS.critical);
});

test('builder-функции принимают свой title вместо дефолтного', () => {
    const embed = successEmbed('Комната переименована', 'Переименовано').toJSON();
    assert.equal(embed.description, '### Переименовано\n-# Комната переименована');
});

test('neutralEmbed без title даёт только subtext-строку', () => {
    const embed = neutralEmbed('Сообщение удалено').toJSON();
    assert.equal(embed.description, '-# Сообщение удалено');
    assert.equal(embed.color, COLORS.neutral);
});
