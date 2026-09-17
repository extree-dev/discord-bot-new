const test = require('node:test');
const assert = require('node:assert/strict');
const { RULES_TEXT, buildRulesEmbed } = require('../rules/model');

const EMOJI_REGEX = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2100}-\u{214F}]/u;

test('текст правил использует только markdown-заголовки (#, ##, ###) и списки через "- ", без эмодзи', () => {
    assert.match(RULES_TEXT, /^# [^\n]+/);
    assert.match(RULES_TEXT, /\n## [^\n]+/);
    assert.match(RULES_TEXT, /\n### [^\n]+/);
    assert.match(RULES_TEXT, /\n- [^\n]+/);
    assert.equal(EMOJI_REGEX.test(RULES_TEXT), false);
});

test('buildRulesEmbed собирает embed с текстом правил в описании', () => {
    const embed = buildRulesEmbed().toJSON();
    assert.equal(embed.description, RULES_TEXT);
    assert.ok(embed.color);
});
