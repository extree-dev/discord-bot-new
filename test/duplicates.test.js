const test = require('node:test');
const assert = require('node:assert/strict');
const {
    findDuplicateRoles,
    findDuplicateChannels,
    buildIdReplacementMap,
    replaceIdsDeep,
} = require('../utils/duplicates');

test('findDuplicateRoles: группирует по имени без учёта регистра/пробелов, canonical — самый старый ID', () => {
    const roles = [
        { id: '200', name: 'Support', managed: false, everyone: false },
        { id: '100', name: ' support ', managed: false, everyone: false },
        { id: '150', name: 'Moderator', managed: false, everyone: false },
    ];
    const groups = findDuplicateRoles(roles);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].canonical.id, '100');
    assert.deepEqual(
        groups[0].extras.map(r => r.id),
        ['200']
    );
});

test('findDuplicateRoles: managed-роли и @everyone никогда не считаются дублями', () => {
    const roles = [
        { id: '1', name: 'Bot', managed: true, everyone: false },
        { id: '2', name: 'Bot', managed: true, everyone: false },
        { id: '3', name: '@everyone', managed: false, everyone: true },
    ];
    assert.deepEqual(findDuplicateRoles(roles), []);
});

test('findDuplicateChannels: дубль только при совпадении типа, родителя и имени', () => {
    const channels = [
        { id: '300', type: 0, parentId: 'cat1', name: 'общий' },
        { id: '100', type: 0, parentId: 'cat1', name: 'Общий' },
        { id: '200', type: 0, parentId: 'cat2', name: 'общий' }, // другой родитель — не дубль
        { id: '400', type: 4, parentId: null, name: 'общий' }, // другой тип — не дубль
    ];
    const groups = findDuplicateChannels(channels);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].canonical.id, '100');
    assert.deepEqual(
        groups[0].extras.map(c => c.id),
        ['300']
    );
});

test('buildIdReplacementMap: собирает extra->canonical по всем группам сразу', () => {
    const groups = [
        { canonical: { id: 'a' }, extras: [{ id: 'b' }, { id: 'c' }] },
        { canonical: { id: 'x' }, extras: [{ id: 'y' }] },
    ];
    const map = buildIdReplacementMap(groups);
    assert.equal(map.get('b'), 'a');
    assert.equal(map.get('c'), 'a');
    assert.equal(map.get('y'), 'x');
    assert.equal(map.size, 3);
});

test('replaceIdsDeep: заменяет только точные совпадения строк, рекурсивно по объектам/массивам, ключи не трогает', () => {
    const idMap = new Map([['old1', 'new1']]);
    const input = {
        channelId: 'old1',
        untouched: 'old1-ish',
        nested: { categoryId: 'old1', other: 'keep' },
        list: ['old1', 'keep2'],
        // составной ключ содержит old1 как подстроку, но не как отдельное
        // значение — не должен совпасть
        users: { old1_someUser: 5 },
        num: 42,
        nil: null,
    };
    const result = replaceIdsDeep(input, idMap);
    assert.equal(result.channelId, 'new1');
    assert.equal(result.untouched, 'old1-ish');
    assert.equal(result.nested.categoryId, 'new1');
    assert.equal(result.nested.other, 'keep');
    assert.deepEqual(result.list, ['new1', 'keep2']);
    assert.deepEqual(result.users, { old1_someUser: 5 });
    assert.equal(result.num, 42);
    assert.equal(result.nil, null);
    // не мутирует исходный объект
    assert.equal(input.channelId, 'old1');
});
