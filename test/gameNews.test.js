const test = require('node:test');
const assert = require('node:assert/strict');
const gameNews = require('../gameNews');
const config = require('../gameNews/config');

test('GAMES: 7 уникальных игр из пула ролей (без Valorant — у него своя система новостей), у каждой есть key/name/slug/emoji/color/customEmojiName', () => {
    assert.equal(gameNews.GAMES.length, 7);
    assert.deepEqual(
        gameNews.GAMES.map(g => g.name),
        ['CS2', 'War Thunder', 'Call of Duty', 'Dota 2', 'Apex Legends', 'Minecraft', 'GTA']
    );
    assert.ok(
        !gameNews.GAMES.some(g => g.name === 'Valorant'),
        'Valorant не должен попадать в gameNews — у него отдельная valorantNews/'
    );
    const keys = gameNews.GAMES.map(g => g.key);
    assert.equal(new Set(keys).size, keys.length, 'ключи не должны повторяться');
    for (const game of gameNews.GAMES) {
        assert.ok(game.slug, `у ${game.name} должен быть slug`);
        assert.ok(game.emoji, `у ${game.name} должен быть emoji`);
        assert.equal(typeof game.color, 'number', `у ${game.name} должен быть числовой color`);
        assert.ok(game.customEmojiName, `у ${game.name} должен быть customEmojiName для панели`);
    }
});

test('newsRoleName: не совпадает с названием самой игровой роли', () => {
    for (const game of gameNews.GAMES) {
        const name = gameNews.newsRoleName(game);
        assert.notEqual(name, game.name);
        assert.match(name, new RegExp(game.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('saveTargets/getConfig: категория, каналы и роли-пинги новостей сохраняются и перечитываются', async () => {
    const before = await gameNews.getConfig();
    try {
        await gameNews.saveTargets({
            categoryId: 'cat-1',
            channels: { cs2: 'chan-1', gta: 'chan-2' },
            newsRoleIds: { cs2: 'role-news-1' },
        });
        const after = await gameNews.getConfig();
        assert.equal(after.categoryId, 'cat-1');
        assert.deepEqual(after.channels, { cs2: 'chan-1', gta: 'chan-2' });
        assert.deepEqual(after.newsRoleIds, { cs2: 'role-news-1' });
    } finally {
        await config.save(before);
    }
});
