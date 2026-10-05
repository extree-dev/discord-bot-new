const test = require('node:test');
const assert = require('node:assert/strict');
const { isPhishingLink, isExcessiveCaps, extractInviteCodes } = require('../security/automod');

test('isPhishingLink узнаёт типичные скам-домены (нитро/стим-подарки)', () => {
    assert.equal(isPhishingLink('забери подарок на discord-nitro.ru прямо сейчас'), true);
    assert.equal(isPhishingLink('выиграй скин на steamcommunity-trade.com'), true);
    assert.equal(isPhishingLink('обычная ссылка на https://discord.com/channels/1/2'), false);
    assert.equal(isPhishingLink('привет, как дела?'), false);
});

test('isExcessiveCaps срабатывает только на длинный текст с большой долей заглавных букв', () => {
    assert.equal(isExcessiveCaps('ВСЕМ ПРИВЕТ ЭТО СПАМ СООБЩЕНИЕ КАПСОМ'), true);
    assert.equal(isExcessiveCaps('HELLO EVERYONE THIS IS SHOUTING TEXT'), true);
    assert.equal(isExcessiveCaps('Привет, как дела у всех сегодня?'), false);
    assert.equal(isExcessiveCaps('ОК'), false);
});

test('extractInviteCodes: достаёт код(ы) приглашения из discord.gg/discord.com/invite, в нижнем регистре', () => {
    assert.deepEqual(extractInviteCodes('заходи сюда discord.gg/AbC123'), ['abc123']);
    assert.deepEqual(extractInviteCodes('https://discord.com/invite/my-server'), ['my-server']);
    assert.deepEqual(extractInviteCodes('обычное сообщение без ссылок'), []);
    assert.deepEqual(extractInviteCodes('два приглашения: discord.gg/one и discord.gg/two'), ['one', 'two']);
});
