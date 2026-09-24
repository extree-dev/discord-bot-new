const test = require('node:test');
const assert = require('node:assert/strict');
const gameNews = require('../gameNews');
const config = require('../gameNews/config');

test('GAMES: 8 уникальных игр из пула ролей, у каждой есть key/name/slug/emoji', () => {
    assert.equal(gameNews.GAMES.length, 8);
    assert.deepEqual(
        gameNews.GAMES.map(g => g.name),
        ['Valorant', 'CS2', 'War Thunder', 'Call of Duty', 'Dota 2', 'Apex Legends', 'Minecraft', 'GTA']
    );
    const keys = gameNews.GAMES.map(g => g.key);
    assert.equal(new Set(keys).size, keys.length, 'ключи не должны повторяться');
    for (const game of gameNews.GAMES) {
        assert.ok(game.slug, `у ${game.name} должен быть slug`);
        assert.ok(game.emoji, `у ${game.name} должен быть emoji`);
    }
});

test('saveTargets/getConfig: категория и каналы сохраняются и перечитываются', async () => {
    const before = await gameNews.getConfig();
    try {
        await gameNews.saveTargets({ categoryId: 'cat-1', channels: { valorant: 'chan-1', cs2: 'chan-2' } });
        const after = await gameNews.getConfig();
        assert.equal(after.categoryId, 'cat-1');
        assert.deepEqual(after.channels, { valorant: 'chan-1', cs2: 'chan-2' });
    } finally {
        await config.save(before);
    }
});
