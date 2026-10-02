const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const { getAllRulesText, buildRulesMessage } = require('../rules/model');

const EMOJI_REGEX = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2100}-\u{214F}]/u;
const MEDIA_GALLERY_TYPE = 12;
const SEPARATOR_TYPE = 14;

test('текст правил использует markdown-заголовки (#, ###), без эмодзи', () => {
    const text = getAllRulesText();
    assert.match(text, /^# [^\n]+/);
    assert.match(text, /\n### [^\n]+/);
    assert.equal(EMOJI_REGEX.test(text), false);
});

test('buildRulesMessage: собирает Components V2 сообщение из нескольких карточек одного акцентного цвета, каждая с баннером-картинкой и разделителем перед текстом', () => {
    const message = buildRulesMessage();
    assert.equal(message.flags, MessageFlags.IsComponentsV2);
    assert.ok(message.components.length > 1, 'ожидается несколько отдельных карточек, не одна стена текста');
    assert.equal(message.files.length, message.components.length, 'у каждой карточки должен быть свой файл баннера');

    const colors = new Set();
    for (const [i, container] of message.components.entries()) {
        const json = container.toJSON();
        assert.ok(json.accent_color, 'у каждой карточки должен быть акцентный цвет');
        colors.add(json.accent_color);

        const gallery = json.components.find(c => c.type === MEDIA_GALLERY_TYPE);
        assert.ok(gallery, 'в начале карточки должен быть баннер (MediaGallery)');
        assert.equal(gallery.items[0].media.url, `attachment://rules-banner-${i}.png`);

        assert.ok(
            json.components.some(c => c.type === SEPARATOR_TYPE),
            'между баннером и текстом должен быть разделитель (Separator, type 14)'
        );
    }
    assert.equal(colors.size, 1, 'все карточки должны быть одного акцентного цвета, не разноцветные');
});

test('buildRulesMessage(ideaChannelId): хотя бы одна карточка подставляет упоминание канала ideaQueue вместо статичной строки про кнопку', () => {
    const withChannel = buildRulesMessage('123456789012345678');
    const allText = withChannel.components.map(c => JSON.stringify(c.toJSON())).join('\n');
    assert.match(allText, /<#123456789012345678>/);
    assert.doesNotMatch(allText, /через систему предложений \(кнопка/);

    const withoutChannel = buildRulesMessage();
    const allTextDefault = withoutChannel.components.map(c => JSON.stringify(c.toJSON())).join('\n');
    assert.match(allTextDefault, /через систему предложений \(кнопка/);
});
