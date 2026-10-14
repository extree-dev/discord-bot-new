const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const crypto = require('crypto');
const uploads = require('../uploads/model');
const { getPool, closePool } = require('../utils/db');

after(() => closePool());

async function withUpload(id, fn) {
    try {
        await fn();
    } finally {
        await getPool().query('DELETE FROM site_uploads WHERE id = $1', [id]);
    }
}

test('save/load: круглый путь сохраняет mime-type и байты как есть', async () => {
    const id = crypto.randomUUID();
    await withUpload(id, async () => {
        const data = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        await uploads.save({ id, mimeType: 'image/png', data });
        const loaded = await uploads.load(id);
        assert.equal(loaded.mimeType, 'image/png');
        assert.deepEqual(loaded.data, data);
    });
});

test('load: несуществующий id — null, а не исключение', async () => {
    assert.equal(await uploads.load(crypto.randomUUID()), null);
});

test('ALLOWED_MIME_TYPES: содержит основные растровые форматы и SVG', () => {
    assert.equal(uploads.ALLOWED_MIME_TYPES.has('image/png'), true);
    assert.equal(uploads.ALLOWED_MIME_TYPES.has('image/jpeg'), true);
    assert.equal(uploads.ALLOWED_MIME_TYPES.has('image/svg+xml'), true);
    assert.equal(uploads.ALLOWED_MIME_TYPES.has('application/pdf'), false);
});
