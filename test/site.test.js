const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, DEFAULTS, MAX_LINKS } = require('../site/model');

test('normalize: пустой объект — все поля заменяются дефолтами', () => {
    assert.deepEqual(normalize({}), DEFAULTS);
});

test('normalize: обрезает пробелы у имени/роли/био', () => {
    const result = normalize({ name: '  Имя  ', role: '  Роль  ', bio: '  Био  ', links: [] });
    assert.equal(result.name, 'Имя');
    assert.equal(result.role, 'Роль');
    assert.equal(result.bio, 'Био');
});

test('normalize: пустое имя/био откатывается к дефолту, пустая роль — просто пустая строка', () => {
    const result = normalize({ name: '   ', role: '   ', bio: '   ', links: [] });
    assert.equal(result.name, DEFAULTS.name);
    assert.equal(result.role, '');
    assert.equal(result.bio, DEFAULTS.bio);
});

test('normalize: ссылки без label отбрасываются, остальные обрезаются по пробелам', () => {
    const result = normalize({
        links: [
            { label: '  Сайт  ', url: '  https://example.com  ' },
            { label: '   ', url: 'https://ignored.example' },
            { label: 'Просто текст', url: '' },
        ],
    });
    assert.deepEqual(result.links, [
        { label: 'Сайт', url: 'https://example.com' },
        { label: 'Просто текст', url: '' },
    ]);
});

test('normalize: пустой итоговый список ссылок откатывается к дефолту', () => {
    const result = normalize({ links: [{ label: '', url: 'https://example.com' }] });
    assert.deepEqual(result.links, DEFAULTS.links);
});

test('normalize: лишние ссылки сверх MAX_LINKS обрезаются', () => {
    const links = Array.from({ length: MAX_LINKS + 3 }, (_, i) => ({ label: `Ссылка ${i}`, url: '' }));
    const result = normalize({ links });
    assert.equal(result.links.length, MAX_LINKS);
});

test('normalize: не-массив в links откатывается к дефолту', () => {
    const result = normalize({ links: 'не массив' });
    assert.deepEqual(result.links, DEFAULTS.links);
});
