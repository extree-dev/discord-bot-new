const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const { getAllMemoText, buildMemoMessage } = require('../memo/model');

const MEDIA_GALLERY_TYPE = 12;
const SEPARATOR_TYPE = 14;

test('buildMemoMessage: собирает Components V2 сообщение из нескольких карточек одного акцентного цвета, каждая с баннером-картинкой и разделителем перед текстом', () => {
    const message = buildMemoMessage();
    assert.equal(message.flags, MessageFlags.IsComponentsV2);
    assert.ok(message.components.length > 1, 'ожидается несколько отдельных карточек');
    assert.equal(message.files.length, message.components.length, 'у каждой карточки должен быть свой файл баннера');

    const colors = new Set();
    for (const [i, container] of message.components.entries()) {
        const json = container.toJSON();
        assert.ok(json.accent_color, 'у каждой карточки должен быть акцентный цвет');
        colors.add(json.accent_color);

        const gallery = json.components.find(c => c.type === MEDIA_GALLERY_TYPE);
        assert.ok(gallery, 'в начале карточки должен быть баннер (MediaGallery)');
        assert.equal(gallery.items[0].media.url, `attachment://memo-banner-${i}.png`);

        assert.ok(
            json.components.some(c => c.type === SEPARATOR_TYPE),
            'между баннером и текстом должен быть разделитель (Separator, type 14)'
        );
    }
    assert.equal(colors.size, 1, 'все карточки должны быть одного акцентного цвета');
});

test('buildMemoMessage(ids): при известных ID каналов подставляет живые упоминания вместо текстовых названий', () => {
    const ids = {
        rulesChannelId: '1',
        newsChannelId: '2',
        levelChannelId: '3',
        ticketChannelId: '4',
        ideaButtonChannelId: '5',
        ideaResultsChannelId: '6',
        ideaDirectChannelId: '7',
        voiceTriggerChannelId: '8',
    };
    const text = getAllMemoText(ids);
    for (const id of Object.values(ids)) {
        assert.match(text, new RegExp(`<#${id}>`));
    }
});

test('buildMemoMessage(): без ID каналов (фичи ещё не настроены) подставляет текстовые названия, а не битые упоминания', () => {
    const text = getAllMemoText();
    assert.doesNotMatch(text, /<#undefined>/);
    assert.match(text, /#правила/);
    assert.match(text, /#открыть-тикет/);
});

test('текст памятки перечисляет реальные команды бота', () => {
    const text = getAllMemoText();
    assert.match(text, /\/rules/);
    assert.match(text, /\/level profile/);
    assert.match(text, /\/help/);
});

test('текст памятки объясняет контекстное меню "Пожаловаться на сообщение"', () => {
    const text = getAllMemoText();
    assert.match(text, /Пожаловаться на сообщение/);
    assert.match(text, /Приложения/);
});
