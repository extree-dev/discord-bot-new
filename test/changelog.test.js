const test = require('node:test');
const assert = require('node:assert/strict');
const { parseChangelog, getEntry, getLatestEntries } = require('../changelog/model');

const SAMPLE = [
    '# Changelog',
    '',
    'Текст-преамбула, не относится ни к одной версии.',
    '',
    '## [Unreleased]',
    '',
    '### Добавлено',
    '',
    '- черновик, не должен попасть в результат',
    '',
    '## [3.0.0] — большое обновление',
    '',
    '### Добавлено',
    '',
    '- пункт 1',
    '- пункт 2',
    '',
    '## [2.0.0] — рефакторинг',
    '',
    '### Изменено',
    '',
    '- пункт из 2.0.0',
    '',
    '## [1.0.0]',
    '',
    '- первый релиз',
].join('\n');

test('parseChangelog находит секции по версии и исключает [Unreleased]', () => {
    const sections = parseChangelog(SAMPLE);
    assert.deepEqual(
        sections.map(s => s.version),
        ['3.0.0', '2.0.0', '1.0.0']
    );
});

test('parseChangelog разбирает заголовок версии и тело секции', () => {
    const [latest] = parseChangelog(SAMPLE);
    assert.equal(latest.version, '3.0.0');
    assert.equal(latest.title, 'большое обновление');
    assert.match(latest.body, /пункт 1/);
    assert.match(latest.body, /пункт 2/);
    assert.doesNotMatch(latest.body, /рефакторинг/);
});

test('parseChangelog: версия без заголовка после номера — title пустая строка', () => {
    const sections = parseChangelog(SAMPLE);
    const first = sections.find(s => s.version === '1.0.0');
    assert.equal(first.title, '');
    assert.match(first.body, /первый релиз/);
});

test('getEntry находит секцию по номеру версии, иначе null', () => {
    assert.equal(getEntry('2.0.0', SAMPLE)?.title, 'рефакторинг');
    assert.equal(getEntry('9.9.9', SAMPLE), null);
    assert.equal(getEntry('Unreleased', SAMPLE), null);
});

test('getLatestEntries(n) возвращает не больше n секций в порядке файла', () => {
    assert.deepEqual(
        getLatestEntries(2, SAMPLE).map(s => s.version),
        ['3.0.0', '2.0.0']
    );
    assert.equal(getLatestEntries(10, SAMPLE).length, 3);
});
