const test = require('node:test');
const assert = require('node:assert/strict');
const {
    APPROVE_PREFIX,
    REJECT_PREFIX,
    REMIND_THRESHOLD_MS,
    buildReviewCard,
    buildReviewButtons,
    buildApprovedEmbed,
    buildOutcomeCard,
    findStaleEntries,
    buildStaleReminderMessage,
} = require('../ideaQueue/model');

test('buildReviewButtons: customId несёт pendingId с нужными префиксами', () => {
    const row = buildReviewButtons('abc123');
    const ids = row.components.map(c => c.toJSON().custom_id);
    assert.deepEqual(ids, [`${APPROVE_PREFIX}abc123`, `${REJECT_PREFIX}abc123`]);
});

test('buildReviewCard: строится с текстом и без падения на пустом content', () => {
    const review = buildReviewCard({ authorId: 'u1', authorTag: 'User#0001', content: 'Добавьте тёмную тему' });
    assert.ok(review);

    const reviewEmpty = buildReviewCard({ authorId: 'u1', authorTag: 'User#0001', content: '' });
    assert.ok(reviewEmpty);
});

test('buildApprovedEmbed: классический embed с "Идея:"/"Прислал:" и упоминанием автора, thumbnail — только если есть avatarURL', () => {
    const withAvatar = buildApprovedEmbed({
        authorId: 'u1',
        avatarURL: 'https://cdn.discordapp.com/avatars/u1/abc.png',
        content: 'Добавьте тёмную тему',
    }).toJSON();
    assert.match(withAvatar.description, /\*\*Идея:\*\*\nДобавьте тёмную тему/);
    assert.match(withAvatar.description, /\*\*Прислал:\*\*\n<@u1>/);
    assert.equal(withAvatar.thumbnail.url, 'https://cdn.discordapp.com/avatars/u1/abc.png');

    const withoutAvatar = buildApprovedEmbed({ authorId: 'u1', avatarURL: null, content: '' }).toJSON();
    assert.match(withoutAvatar.description, /\*\(сообщение без текста\)\*/);
    assert.equal(withoutAvatar.thumbnail, undefined);
});

test('buildOutcomeCard: строит карточку для одобрено/отклонено/истекло, не падает', () => {
    const approved = buildOutcomeCard('approved', { authorId: 'u1', moderator: '<@u2>' });
    const rejected = buildOutcomeCard('rejected', { authorId: 'u1', moderator: '<@u2>' });
    const expired = buildOutcomeCard('expired', {});
    assert.ok(approved);
    assert.ok(rejected);
    assert.ok(expired);
});

test('findStaleEntries: только заявки старше порога и без уже отправленного напоминания', () => {
    const now = 1_000_000;
    const pending = new Map([
        ['fresh', { createdAt: now - 1000 }],
        ['stale', { createdAt: now - REMIND_THRESHOLD_MS }],
        ['staleButReminded', { createdAt: now - REMIND_THRESHOLD_MS * 2, remindedAt: now - 1000 }],
    ]);
    const result = findStaleEntries(pending, now);
    assert.deepEqual(
        result.map(r => r.pendingId),
        ['stale']
    );
});

test('buildStaleReminderMessage: не падает и различает единственное число', () => {
    const now = 1_000_000;
    const single = buildStaleReminderMessage(1, now - 2 * 60 * 60 * 1000, now);
    const many = buildStaleReminderMessage(3, now - 5 * 60 * 60 * 1000, now);
    assert.ok(single);
    assert.ok(many);
});
