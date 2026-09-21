const test = require('node:test');
const assert = require('node:assert/strict');
const {
    APPROVE_PREFIX,
    REJECT_PREFIX,
    buildReviewCard,
    buildReviewButtons,
    buildApprovedCard,
    buildOutcomeCard,
} = require('../ideaQueue/model');

test('buildReviewButtons: customId несёт pendingId с нужными префиксами', () => {
    const row = buildReviewButtons('abc123');
    const ids = row.components.map(c => c.toJSON().custom_id);
    assert.deepEqual(ids, [`${APPROVE_PREFIX}abc123`, `${REJECT_PREFIX}abc123`]);
});

test('buildReviewCard/buildApprovedCard: строятся с текстом и без падения на пустом content', () => {
    const review = buildReviewCard({ authorId: 'u1', authorTag: 'User#0001', content: 'Добавьте тёмную тему' });
    assert.ok(review);

    const reviewEmpty = buildReviewCard({ authorId: 'u1', authorTag: 'User#0001', content: '' });
    assert.ok(reviewEmpty);

    const approved = buildApprovedCard({ authorDisplayName: 'User', content: 'Добавьте тёмную тему' });
    assert.ok(approved);

    const approvedEmpty = buildApprovedCard({ authorDisplayName: 'User', content: '' });
    assert.ok(approvedEmpty);
});

test('buildOutcomeCard: строит карточку для одобрено/отклонено/истекло, не падает', () => {
    const approved = buildOutcomeCard('approved', { authorId: 'u1', moderator: '<@u2>' });
    const rejected = buildOutcomeCard('rejected', { authorId: 'u1', moderator: '<@u2>' });
    const expired = buildOutcomeCard('expired', {});
    assert.ok(approved);
    assert.ok(rejected);
    assert.ok(expired);
});
