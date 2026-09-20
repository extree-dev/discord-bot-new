const test = require('node:test');
const assert = require('node:assert/strict');
const { sendPunishmentDm, APPEAL_BUTTON_CUSTOM_ID } = require('../utils/punishmentNotice');

function makeUser() {
    const calls = [];
    return {
        calls,
        send: async payload => {
            calls.push(payload);
        },
    };
}

test('sendPunishmentDm: бан — без кнопки апелляции (после бана участник больше не на сервере)', async () => {
    const user = makeUser();
    await sendPunishmentDm(user, { name: 'Тестовый сервер' }, { kind: 'ban', reason: 'Читерство' });

    assert.equal(user.calls.length, 1);
    const payload = user.calls[0];
    assert.equal(payload.components.length, 0);

    const embedJson = payload.embeds[0].toJSON();
    assert.ok(embedJson.description.includes('Тестовый сервер'));
    assert.ok(embedJson.fields.some(f => f.name === 'Наказание' && f.value === 'Бан'));
    assert.ok(embedJson.fields.some(f => f.name === 'Причина' && f.value === 'Читерство'));
});

test('sendPunishmentDm: таймаут — с кнопкой апелляции и длительностью в подписи наказания', async () => {
    const user = makeUser();
    await sendPunishmentDm(
        user,
        { name: 'Тестовый сервер' },
        { kind: 'timeout', reason: 'Спам', durationLabel: '1 ч' }
    );

    const payload = user.calls[0];
    assert.equal(payload.components.length, 1);
    const button = payload.components[0].components[0].toJSON();
    assert.equal(button.custom_id, APPEAL_BUTTON_CUSTOM_ID);

    const embedJson = payload.embeds[0].toJSON();
    assert.ok(embedJson.fields.some(f => f.name === 'Наказание' && f.value === 'Мут (таймаут) (1 ч)'));
});

test('sendPunishmentDm: не бросает исключение, если у участника закрыты личные сообщения', async () => {
    const user = { send: async () => Promise.reject(new Error('Cannot send messages to this user')) };
    await assert.doesNotReject(sendPunishmentDm(user, { name: 'X' }, { kind: 'ban', reason: 'y' }));
});
