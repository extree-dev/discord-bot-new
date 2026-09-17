const test = require('node:test');
const assert = require('node:assert/strict');
const { addWarning, getWarnings, clearWarnings, filePath } = require('../utils/warnings');
const { withBackup } = require('./helpers/withBackup');

test('addWarning копит предупреждения, getWarnings их возвращает, clearWarnings очищает', async () => {
    await withBackup(filePath, () => {
        const guildId = 'test-guild-warnings';
        const userId = 'test-user-warnings';
        clearWarnings(guildId, userId);

        assert.deepEqual(getWarnings(guildId, userId), []);

        const afterFirst = addWarning(guildId, userId, 'Спам', 'Модератор#0001');
        assert.equal(afterFirst.length, 1);
        assert.equal(afterFirst[0].reason, 'Спам');
        assert.equal(afterFirst[0].moderatorTag, 'Модератор#0001');
        assert.ok(afterFirst[0].date, 'у записи должна быть дата');

        const afterSecond = addWarning(guildId, userId, 'Оффтоп', 'Модератор#0002');
        assert.equal(afterSecond.length, 2);
        assert.deepEqual(getWarnings(guildId, userId), afterSecond);

        clearWarnings(guildId, userId);
        assert.deepEqual(getWarnings(guildId, userId), []);
    });
});

test('предупреждения разных пользователей/серверов не пересекаются', async () => {
    await withBackup(filePath, () => {
        clearWarnings('guild-a', 'user-a');
        clearWarnings('guild-b', 'user-a');

        addWarning('guild-a', 'user-a', 'причина', 'Модератор');

        assert.equal(getWarnings('guild-a', 'user-a').length, 1);
        assert.equal(getWarnings('guild-b', 'user-a').length, 0);

        clearWarnings('guild-a', 'user-a');
    });
});
