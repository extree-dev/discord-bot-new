const test = require('node:test');
const assert = require('node:assert/strict');
const {
    COLORS,
    errorEmbed,
    successEmbed,
    infoEmbed,
    warningEmbed,
    criticalEmbed,
    neutralEmbed,
} = require('../utils/embeds');

test('errorEmbed собирает embed цвета danger с заголовком по умолчанию и переданным текстом', () => {
    const embed = errorEmbed('Что-то пошло не так').toJSON();
    assert.equal(embed.title, 'Ошибка');
    assert.equal(embed.description, 'Что-то пошло не так');
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
    assert.equal(embed.title, 'Переименовано');
});

test('neutralEmbed не выставляет title, если он не передан', () => {
    const embed = neutralEmbed('Сообщение удалено').toJSON();
    assert.equal(embed.title, undefined);
    assert.equal(embed.color, COLORS.neutral);
});
