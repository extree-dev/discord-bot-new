const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { createStore } = require('../utils/pgStore');
const { getPool, closePool } = require('../utils/db');

after(() => closePool());

async function withStore(name, fn) {
    try {
        await fn();
    } finally {
        await getPool().query('DELETE FROM bot_stores WHERE name = $1', [name]);
    }
}

test('save: возвращает сохранённый конфиг, а не undefined', async () => {
    const storeName = `test-pgstore-save-${Date.now()}`;
    await withStore(storeName, async () => {
        const store = createStore(storeName, { a: 1 });
        const result = await store.save({ a: 2, b: 'x' });
        assert.deepEqual(result, { a: 2, b: 'x' });

        const loaded = await store.load();
        assert.equal(loaded.a, 2);
        assert.equal(loaded.b, 'x');
    });
});
