const test = require('node:test');
const assert = require('node:assert/strict');
const { findUnseenArticles, mergeSeenIds, buildNewsCard } = require('../valorantNews/model');

function article(id, date, overrides = {}) {
    return { id, date, title: `Статья ${id}`, url: `https://example.com/${id}`, description: null, ...overrides };
}

test('findUnseenArticles: только ещё не виденные статьи, от старых к новым', () => {
    const articles = [
        article('c', '2026-09-20T00:00:00Z'),
        article('a', '2026-09-10T00:00:00Z'),
        article('b', '2026-09-15T00:00:00Z'),
    ];
    assert.deepEqual(
        findUnseenArticles(articles, ['a']).map(a => a.id),
        ['b', 'c']
    );
});

test('findUnseenArticles: анонс с датой из будущего не мешает публикации более ранних статей', () => {
    const trailer = article('trailer', '2026-12-05T00:00:00Z');
    const news = article('news', '2026-09-22T00:00:00Z');
    assert.deepEqual(
        findUnseenArticles([trailer, news], ['trailer']).map(a => a.id),
        ['news']
    );
});

test('findUnseenArticles: без id статья узнаётся по url, без обоих — пропускается', () => {
    const noId = article(undefined, '2026-09-10T00:00:00Z', { url: 'https://example.com/x' });
    const nothing = article(undefined, '2026-09-11T00:00:00Z', { url: undefined });
    assert.deepEqual(findUnseenArticles([noId, nothing], ['https://example.com/x']), []);
    assert.deepEqual(findUnseenArticles([noId, nothing], []), [noId]);
});

test('mergeSeenIds: текущая лента плюс выпавшие из неё, без повторов и с ограничением размера', () => {
    const articles = [article('b', '2026-09-15T00:00:00Z'), article('c', '2026-09-20T00:00:00Z')];
    assert.deepEqual(mergeSeenIds(articles, ['a', 'b']), ['b', 'c', 'a']);
    const many = Array.from({ length: 250 }, (_, i) => `old-${i}`);
    assert.equal(mergeSeenIds(articles, many).length, 200);
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
