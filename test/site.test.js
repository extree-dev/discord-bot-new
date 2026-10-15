const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalize,
    DEFAULTS,
    MAX_LINKS,
    MAX_CLIENTS,
    MAX_SHOWCASES,
    MAX_SHOWCASE_TAGS,
    SHOWCASE_CATEGORIES,
} = require('../site/model');

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

test('normalize: клиенты без name или logoUrl отбрасываются, остальные обрезаются по пробелам', () => {
    const result = normalize({
        clients: [
            { name: '  Nebula  ', logoUrl: '  https://example.com/nebula.png  ' },
            { name: '   ', logoUrl: 'https://example.com/ignored.png' },
            { name: 'Без лого', logoUrl: '' },
            { name: '', logoUrl: '' },
        ],
    });
    assert.deepEqual(result.clients, [{ name: 'Nebula', logoUrl: 'https://example.com/nebula.png', period: '' }]);
});

test('normalize: пустой список клиентов остаётся пустым (бегущая строка выключена, а не фейковая)', () => {
    const result = normalize({ clients: [] });
    assert.deepEqual(result.clients, []);
});

test('normalize: лишние клиенты сверх MAX_CLIENTS обрезаются', () => {
    const clients = Array.from({ length: MAX_CLIENTS + 3 }, (_, i) => ({
        name: `Клиент ${i}`,
        logoUrl: `https://example.com/${i}.png`,
    }));
    const result = normalize({ clients });
    assert.equal(result.clients.length, MAX_CLIENTS);
});

test('normalize: не-массив в clients откатывается к дефолту (пустому списку)', () => {
    const result = normalize({ clients: 'не массив' });
    assert.deepEqual(result.clients, DEFAULTS.clients);
});

test('normalize: проекты без title отбрасываются, остальные поля обрезаются/нормализуются', () => {
    const result = normalize({
        showcases: [
            {
                title: '  The Kitchen  ',
                tags: ['  Bot  ', '', 'Discord', '   '],
                description: '  Описание  ',
                imageUrl: '  https://example.com/kitchen.png  ',
                url: '  https://example.com  ',
                nda: 'truthy-but-not-boolean',
                category: 'tools',
            },
            { title: '   ' },
            { title: '', tags: ['Ignored'] },
        ],
    });
    assert.deepEqual(result.showcases, [
        {
            title: 'The Kitchen',
            tags: ['Bot', 'Discord'],
            description: 'Описание',
            imageUrl: 'https://example.com/kitchen.png',
            url: 'https://example.com',
            nda: true,
            upcoming: false,
            category: 'tools',
        },
    ]);
});

test('normalize: проект без картинки/тегов/url/category сохраняется с пустыми значениями и категорией по умолчанию (не ломается)', () => {
    const result = normalize({ showcases: [{ title: 'Unik' }] });
    assert.deepEqual(result.showcases, [
        {
            title: 'Unik',
            tags: [],
            description: '',
            imageUrl: '',
            url: '',
            nda: false,
            upcoming: false,
            category: 'websites',
        },
    ]);
});

test('normalize: неизвестная category откатывается к дефолту (websites)', () => {
    const result = normalize({ showcases: [{ title: 'Проект', category: 'not-a-real-category' }] });
    assert.equal(result.showcases[0].category, 'websites');
});

test('normalize: каждая из SHOWCASE_CATEGORIES сохраняется как есть', () => {
    for (const category of SHOWCASE_CATEGORIES) {
        const result = normalize({ showcases: [{ title: 'Проект', category }] });
        assert.equal(result.showcases[0].category, category);
    }
});

test('normalize: пустой список проектов остаётся пустым (секция work скрыта, а не фейковая)', () => {
    const result = normalize({ showcases: [] });
    assert.deepEqual(result.showcases, []);
});

test('normalize: лишние проекты сверх MAX_SHOWCASES обрезаются', () => {
    const showcases = Array.from({ length: MAX_SHOWCASES + 3 }, (_, i) => ({ title: `Проект ${i}` }));
    const result = normalize({ showcases });
    assert.equal(result.showcases.length, MAX_SHOWCASES);
});

test('normalize: лишние теги сверх MAX_SHOWCASE_TAGS обрезаются', () => {
    const tags = Array.from({ length: MAX_SHOWCASE_TAGS + 3 }, (_, i) => `Тег ${i}`);
    const result = normalize({ showcases: [{ title: 'Проект', tags }] });
    assert.equal(result.showcases[0].tags.length, MAX_SHOWCASE_TAGS);
});

test('normalize: не-массив в showcases откатывается к дефолту (пустому списку)', () => {
    const result = normalize({ showcases: 'не массив' });
    assert.deepEqual(result.showcases, DEFAULTS.showcases);
});
