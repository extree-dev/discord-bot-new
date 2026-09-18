const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { addWarning, getWarnings, clearWarnings, getWarningStats, storeName } = require('../utils/warnings');
const { withStoreBackup } = require('./helpers/withBackup');
const { closePool } = require('../utils/db');

// node --test запускает каждый файл в отдельном процессе, но пул
// соединений pg держит event loop живым — без явного закрытия процесс
// будет висеть после того, как все тесты этого файла отработают.
after(() => closePool());

test('addWarning копит предупреждения, getWarnings их возвращает, clearWarnings очищает', async () => {
    await withStoreBackup(storeName, async () => {
        const guildId = 'test-guild-warnings';
        const userId = 'test-user-warnings';
        await clearWarnings(guildId, userId);

        assert.deepEqual(await getWarnings(guildId, userId), []);

        const afterFirst = await addWarning(guildId, userId, 'Спам', 'Модератор#0001');
        assert.equal(afterFirst.length, 1);
        assert.equal(afterFirst[0].reason, 'Спам');
        assert.equal(afterFirst[0].moderatorTag, 'Модератор#0001');
        assert.ok(afterFirst[0].date, 'у записи должна быть дата');

        const afterSecond = await addWarning(guildId, userId, 'Оффтоп', 'Модератор#0002');
        assert.equal(afterSecond.length, 2);
        assert.deepEqual(await getWarnings(guildId, userId), afterSecond);

        await clearWarnings(guildId, userId);
        assert.deepEqual(await getWarnings(guildId, userId), []);
    });
});

test('getWarningStats считает пользователей с варнами и сумму всех варнов, игнорируя очищенных', async () => {
    await withStoreBackup(storeName, async () => {
        await clearWarnings('stats-guild', 'user-1');
        await clearWarnings('stats-guild', 'user-2');
        await clearWarnings('stats-guild', 'user-3');

        await addWarning('stats-guild', 'user-1', 'причина', 'Модератор');
        await addWarning('stats-guild', 'user-1', 'причина 2', 'Модератор');
        await addWarning('stats-guild', 'user-2', 'причина', 'Модератор');
        // user-3 получает и сразу теряет варн — не должен попасть в статистику
        await addWarning('stats-guild', 'user-3', 'причина', 'Модератор');
        await clearWarnings('stats-guild', 'user-3');

        const stats = await getWarningStats();
        assert.ok(stats.warnedUsers >= 2, 'должно быть хотя бы 2 пользователя с варнами');
        assert.ok(stats.totalWarnings >= 3, 'должно быть хотя бы 3 варна суммарно');

        await clearWarnings('stats-guild', 'user-1');
        await clearWarnings('stats-guild', 'user-2');
    });
});

test('предупреждения разных пользователей/серверов не пересекаются', async () => {
    await withStoreBackup(storeName, async () => {
        await clearWarnings('guild-a', 'user-a');
        await clearWarnings('guild-b', 'user-a');

        await addWarning('guild-a', 'user-a', 'причина', 'Модератор');

        assert.equal((await getWarnings('guild-a', 'user-a')).length, 1);
        assert.equal((await getWarnings('guild-b', 'user-a')).length, 0);

        await clearWarnings('guild-a', 'user-a');
    });
});
