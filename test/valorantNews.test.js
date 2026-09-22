const test = require('node:test');
const assert = require('node:assert/strict');
const { findNewArticles, latestArticleDate, buildNewsCard } = require('../valorantNews/model');

function article(id, date, overrides = {}) {
    return { id, date, title: `Статья ${id}`, url: `https://example.com/${id}`, description: null, ...overrides };
}

test('findNewArticles: возвращает только статьи строго новее sinceIso, отсортированные от старых к новым', () => {
    const articles = [
        article('c', '2026-09-20T00:00:00Z'),
        article('a', '2026-09-10T00:00:00Z'),
        article('b', '2026-09-15T00:00:00Z'),
    ];
    const fresh = findNewArticles(articles, '2026-09-12T00:00:00Z');
    assert.deepEqual(
        fresh.map(a => a.id),
        ['b', 'c']
    );
});

test('findNewArticles: sinceIso === null считает все статьи новыми', () => {
    const articles = [article('a', '2026-09-10T00:00:00Z'), article('b', '2026-09-15T00:00:00Z')];
    assert.deepEqual(
        findNewArticles(articles, null).map(a => a.id),
        ['a', 'b']
    );
});

test('findNewArticles: ровно та же дата, что и sinceIso — не считается новой', () => {
    const since = '2026-09-15T00:00:00Z';
    const articles = [article('a', since)];
    assert.deepEqual(findNewArticles(articles, since), []);
});

test('latestArticleDate: находит максимальную дату среди статей', () => {
    const articles = [
        article('a', '2026-09-10T00:00:00Z'),
        article('b', '2026-09-20T00:00:00Z'),
        article('c', '2026-09-15T00:00:00Z'),
    ];
    assert.equal(latestArticleDate(articles), '2026-09-20T00:00:00Z');
});

test('latestArticleDate: пустой список — null', () => {
    assert.equal(latestArticleDate([]), null);
});

test('buildNewsCard: заголовок и описание попадают в текст карточки', () => {
    const message = buildNewsCard(
        article('a', '2026-09-20T00:00:00Z', {
            title: 'Patch Notes 13.06',
            url: 'https://playvalorant.com/x',
            description: 'Большой патч',
        })
    );
    const text = message
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.match(text, /Valorant: Patch Notes 13\.06/);
    assert.match(text, /Большой патч/);
});

test('buildNewsCard: ссылка на статью — кнопка, а не текст', () => {
    const message = buildNewsCard(article('a', '2026-09-20T00:00:00Z', { url: 'https://playvalorant.com/x' }));
    const components = message.toJSON().components;
    const actionRow = components.find(c => c.type === 1);
    assert.ok(actionRow, 'ожидали ActionRow с кнопкой-ссылкой');
    assert.equal(actionRow.components[0].url, 'https://playvalorant.com/x');
    const text = components
        .filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.doesNotMatch(text, /playvalorant\.com/);
});

test('buildNewsCard: с banner_url добавляется MediaGallery с этой картинкой', () => {
    const message = buildNewsCard(
        article('a', '2026-09-20T00:00:00Z', { banner_url: 'https://example.com/banner.png' })
    );
    const gallery = message.toJSON().components.find(c => c.type === 12);
    assert.ok(gallery, 'ожидали MediaGallery');
    assert.equal(gallery.items[0].media.url, 'https://example.com/banner.png');
});

test('buildNewsCard: без banner_url MediaGallery не добавляется', () => {
    const message = buildNewsCard(article('a', '2026-09-20T00:00:00Z'));
    const gallery = message.toJSON().components.find(c => c.type === 12);
    assert.equal(gallery, undefined);
});

test('buildNewsCard: известная category даёт текстовый бейдж, неизвестная — нет', () => {
    const withKnown = buildNewsCard(article('a', '2026-09-20T00:00:00Z', { category: 'patch_notes' }));
    const knownText = withKnown
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.match(knownText, /Патч-ноуты/);

    const withUnknown = buildNewsCard(article('a', '2026-09-20T00:00:00Z', { category: 'something_new' }));
    const unknownText = withUnknown
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.doesNotMatch(unknownText, /something_new/);
});

test('buildNewsCard: badgeEmoji попадает в текст бейджа, по умолчанию — юникод-фолбэк', () => {
    const withDefault = buildNewsCard(article('a', '2026-09-20T00:00:00Z', { category: 'patch_notes' }));
    const defaultText = withDefault
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.match(defaultText, /🎯 Патч-ноуты/);

    const withCustom = buildNewsCard(
        article('a', '2026-09-20T00:00:00Z', { category: 'patch_notes' }),
        undefined,
        '<:icons8valorant481:111>'
    );
    const customText = withCustom
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.match(customText, /<:icons8valorant481:111> Патч-ноуты/);
});

test('buildNewsCard: без pingRoleId упоминание роли в карточке отсутствует', () => {
    const message = buildNewsCard(article('a', '2026-09-20T00:00:00Z'));
    const text = message
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.doesNotMatch(text, /<@&/);
});

test('buildNewsCard: с pingRoleId упоминание роли добавляется первой строкой', () => {
    const message = buildNewsCard(article('a', '2026-09-20T00:00:00Z'), '123456789');
    const text = message
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.match(text, /<@&123456789>/);
});
