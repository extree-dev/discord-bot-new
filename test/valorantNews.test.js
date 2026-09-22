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

test('buildNewsCard: заголовок и ссылка попадают в текст карточки', () => {
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
    assert.match(text, /https:\/\/playvalorant\.com\/x/);
});
