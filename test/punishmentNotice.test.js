const test = require('node:test');
const assert = require('node:assert/strict');
const { sendPunishmentDm } = require('../utils/punishmentNotice');

function makeUser() {
    const calls = [];
    return {
        calls,
        send: async payload => {
            calls.push(payload);
        },
    };
}

test('sendPunishmentDm: отключена по решению администратора — ничего не отправляет', async () => {
    const user = makeUser();
    await sendPunishmentDm(user, { name: 'Тестовый сервер' }, { kind: 'ban', reason: 'Читерство' });
    await sendPunishmentDm(
        user,
        { name: 'Тестовый сервер' },
        { kind: 'timeout', reason: 'Спам', durationLabel: '1 ч' }
    );

    assert.equal(user.calls.length, 0);
});
