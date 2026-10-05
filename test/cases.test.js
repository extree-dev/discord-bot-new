const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { addCase, getCase, getCasesForUser, storeName } = require('../cases/model');
const { withStoreBackup } = require('./helpers/withBackup');
const { closePool } = require('../utils/db');

after(() => closePool());

test('addCase выдаёт возрастающие номера, getCase находит дело по номеру', async () => {
    await withStoreBackup(storeName, async () => {
        const guildId = 'test-guild-cases';

        const id1 = await addCase(guildId, 'warn', {
            targetId: 'user-1',
            targetTag: 'User1#0001',
            moderatorTag: 'Мод#0001',
            reason: 'спам',
        });
        const id2 = await addCase(guildId, 'mute', {
            targetId: 'user-2',
            targetTag: 'User2#0002',
            moderatorTag: 'Мод#0001',
            reason: 'оффтоп',
            extra: '10 мин.',
        });

        assert.equal(id2, id1 + 1);

        const case1 = await getCase(guildId, id1);
        assert.equal(case1.type, 'warn');
        assert.equal(case1.targetId, 'user-1');
        assert.equal(case1.reason, 'спам');
        assert.ok(case1.createdAt);

        const case2 = await getCase(guildId, id2);
        assert.equal(case2.type, 'mute');
        assert.equal(case2.extra, '10 мин.');
    });
});

test('getCase: неизвестный номер — null, не падает', async () => {
    await withStoreBackup(storeName, async () => {
        assert.equal(await getCase('unknown-guild', 9999), null);
    });
});

test('getCasesForUser: только дела этого участника, новые первыми, с лимитом', async () => {
    await withStoreBackup(storeName, async () => {
        const guildId = 'cases-user-guild';

        await addCase(guildId, 'warn', { targetId: 'target-a', targetTag: 'A', moderatorTag: 'Мод', reason: '1' });
        await addCase(guildId, 'warn', {
            targetId: 'target-b',
            targetTag: 'B',
            moderatorTag: 'Мод',
            reason: 'не этот',
        });
        const lastId = await addCase(guildId, 'mute', {
            targetId: 'target-a',
            targetTag: 'A',
            moderatorTag: 'Мод',
            reason: '2',
        });

        const list = await getCasesForUser(guildId, 'target-a');
        assert.equal(list.length, 2);
        assert.equal(list[0].id, lastId, 'самое новое дело должно быть первым');
        assert.ok(list.every(c => c.targetId === 'target-a'));
    });
});

test('дела разных серверов не пересекаются', async () => {
    await withStoreBackup(storeName, async () => {
        await addCase('guild-a', 'warn', { targetId: 'u', targetTag: 'U', moderatorTag: 'Мод', reason: 'r' });

        assert.equal((await getCasesForUser('guild-a', 'u')).length, 1);
        assert.equal((await getCasesForUser('guild-b', 'u')).length, 0);
    });
});
