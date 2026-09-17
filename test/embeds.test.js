const test = require('node:test');
const assert = require('node:assert/strict');
const { errorEmbed } = require('../utils/embeds');

test('errorEmbed собирает embed красного цвета с заголовком "Ошибка" и переданным текстом', () => {
    const embed = errorEmbed('Что-то пошло не так').toJSON();
    assert.equal(embed.title, 'Ошибка');
    assert.equal(embed.description, 'Что-то пошло не так');
    assert.equal(embed.color, 0xed4245);
});
