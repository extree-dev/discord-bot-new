const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { addNote, getNotes, removeNote, storeName } = require('../notes/model');
const { withStoreBackup } = require('./helpers/withBackup');
const { closePool } = require('../utils/db');

after(() => closePool());

test('addNote копит заметки, getNotes их возвращает', async () => {
    await withStoreBackup(storeName, async () => {
        const guildId = 'test-guild-notes';
        const userId = 'test-user-notes';

        assert.deepEqual(await getNotes(guildId, userId), []);

        const afterFirst = await addNote(guildId, userId, 'Предупреждён устно в войсе', 'Модератор#0001');
        assert.equal(afterFirst.length, 1);
        assert.equal(afterFirst[0].text, 'Предупреждён устно в войсе');
        assert.equal(afterFirst[0].authorTag, 'Модератор#0001');
        assert.ok(afterFirst[0].date);

        const afterSecond = await addNote(guildId, userId, 'Проверить при следующем нарушении', 'Модератор#0002');
        assert.equal(afterSecond.length, 2);
        assert.deepEqual(await getNotes(guildId, userId), afterSecond);
    });
});

test('removeNote: удаляет по 1-based индексу, не падает на несуществующем', async () => {
    await withStoreBackup(storeName, async () => {
        const guildId = 'remove-guild';
        const userId = 'remove-user';

        await addNote(guildId, userId, 'первая', 'Мод');
        await addNote(guildId, userId, 'вторая', 'Мод');

        const missing = await removeNote(guildId, userId, 5);
        assert.equal(missing.removed, false);

        const removed = await removeNote(guildId, userId, 1);
        assert.equal(removed.removed, true);
        assert.equal(removed.note.text, 'первая');

        const remaining = await getNotes(guildId, userId);
        assert.equal(remaining.length, 1);
        assert.equal(remaining[0].text, 'вторая');

        await removeNote(guildId, userId, 1);
        assert.deepEqual(await getNotes(guildId, userId), []);
    });
});

test('заметки разных пользователей/серверов не пересекаются', async () => {
    await withStoreBackup(storeName, async () => {
        await addNote('guild-a', 'user-a', 'причина', 'Мод');

        assert.equal((await getNotes('guild-a', 'user-a')).length, 1);
        assert.equal((await getNotes('guild-b', 'user-a')).length, 0);
    });
});
