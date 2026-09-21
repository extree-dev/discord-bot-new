const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const {
    isStaff,
    countRecentReportsOn,
    formatDuration,
    formatReportedUser,
    REASONS,
    OPEN_REASON_PREFIX,
    buildPanelMessage,
    buildBugPanelMessage,
    buildSubmissionCard,
} = require('../tickets/model');
const { load, save, storeName } = require('../tickets/config');
const { withStoreBackup } = require('./helpers/withBackup');
const { closePool } = require('../utils/db');

// node --test запускает каждый файл в отдельном процессе, но пул
// соединений pg держит event loop живым — без явного закрытия процесс
// будет висеть после того, как все тесты этого файла отработают.
after(() => closePool());

function makeMember({ roleIds = [], isAdmin = false, isModerator = false }) {
    return {
        roles: { cache: new Set(roleIds) },
        permissions: {
            has(flag) {
                if (isAdmin) return true;
                if (isModerator && flag === PermissionFlagsBits.ModerateMembers) return true;
                return false;
            },
        },
    };
}

// message — payload от toMessage(): components[0] — Container (заголовок/
// текст), остальные — ActionRowBuilder с кнопками тем.
function extractButtonCustomIds(message) {
    return message.components.slice(1).flatMap(row => row.components.map(btn => btn.toJSON().custom_id));
}

test('REASONS: значения уникальны, и только "report" требует выбора пользователя', () => {
    const values = REASONS.map(r => r.value);
    assert.equal(values.length, new Set(values).size);
    const withTargetUser = REASONS.filter(r => r.requiresTargetUser).map(r => r.value);
    assert.deepEqual(withTargetUser, ['report']);
    for (const r of REASONS) {
        assert.equal(typeof r.label, 'string');
        assert.ok(r.label.length > 0);
    }
});

test('REASONS: только "bug" — отдельная (standalone) система', () => {
    const standalone = REASONS.filter(r => r.standalone).map(r => r.value);
    assert.deepEqual(standalone, ['bug']);
});

test('buildPanelMessage: не включает standalone-темы; buildBugPanelMessage — только их', () => {
    const mainIds = extractButtonCustomIds(buildPanelMessage());
    assert.ok(
        !mainIds.includes(`${OPEN_REASON_PREFIX}bug`),
        'основная панель не должна показывать кнопку бага — у него своя'
    );
    assert.ok(mainIds.includes(`${OPEN_REASON_PREFIX}general`));
    assert.ok(mainIds.includes(`${OPEN_REASON_PREFIX}report`));
    assert.ok(mainIds.includes(`${OPEN_REASON_PREFIX}appeal`));
    assert.ok(mainIds.includes(`${OPEN_REASON_PREFIX}other`));

    const bugIds = extractButtonCustomIds(buildBugPanelMessage());
    assert.deepEqual(bugIds, [`${OPEN_REASON_PREFIX}bug`]);
});

test('isStaff: пропускает участника с ролью поддержки', () => {
    const config = { supportRoleId: 'support-role', reasonRoleIds: {} };
    const member = makeMember({ roleIds: ['support-role'] });
    assert.equal(isStaff(config, member), true);
});

test('isStaff: пропускает администратора и модератора даже без роли поддержки', () => {
    const config = { supportRoleId: 'support-role', reasonRoleIds: {} };
    assert.equal(isStaff(config, makeMember({ isAdmin: true })), true);
    assert.equal(isStaff(config, makeMember({ isModerator: true })), true);
});

test('isStaff: обычный участник без роли и прав — не staff', () => {
    const config = { supportRoleId: 'support-role', reasonRoleIds: {} };
    assert.equal(isStaff(config, makeMember({})), false);
});

test('isStaff: специалист-роль темы считается staff глобально (нет больше отдельных "тикетов" со своей темой)', () => {
    const config = {
        supportRoleId: 'support-role',
        reasonRoleIds: { bug: 'dev-role', report: 'reports-role' },
    };
    const devMember = makeMember({ roleIds: ['dev-role'] });
    assert.equal(isStaff(config, devMember), true);
    const outsider = makeMember({ roleIds: ['some-other-role'] });
    assert.equal(isStaff(config, outsider), false);
});

test('countRecentReportsOn: считает только жалобы на того же игрока в пределах окна', () => {
    const now = Date.now();
    const windowMs = 30 * 24 * 60 * 60 * 1000;
    const reports = [
        { targetUserId: 'u1', createdAt: now - 1000 },
        { targetUserId: 'u1', createdAt: now - windowMs - 1000 }, // за окном — не считается
        { targetUserId: 'u2', createdAt: now - 1000 }, // другой игрок — не считается
    ];
    assert.equal(countRecentReportsOn(reports, 'u1', now, windowMs), 1);
    assert.equal(countRecentReportsOn(reports, 'u2', now, windowMs), 1);
    assert.equal(countRecentReportsOn(reports, 'u3', now, windowMs), 0);
});

test('formatDuration форматирует миллисекунды в человекочитаемый вид', () => {
    assert.equal(formatDuration(30000), '<1 мин');
    assert.equal(formatDuration(45 * 60000), '45 мин');
    assert.equal(formatDuration(3 * 3600000 + 30 * 60000), '3 ч 30 мин');
    assert.equal(formatDuration(2 * 86400000 + 3 * 3600000), '2 д 3 ч');
    assert.equal(formatDuration(null), '—');
    assert.equal(formatDuration(-1), '—');
});

test('formatReportedUser: НЕ <@id>-упоминание — только tag (если есть) и ID в code-блоке', () => {
    assert.equal(formatReportedUser('123', 'User#0001'), 'User#0001 (`123`)');
    assert.equal(formatReportedUser('123', null), '`123`');
    assert.ok(!formatReportedUser('123', 'Тег').includes('<@'));
});

test('buildSubmissionCard: "Наказать" — только при targetId, "Снять наказание" — только у обжалования', () => {
    const reportReason = REASONS.find(r => r.value === 'report');
    const appealReason = REASONS.find(r => r.value === 'appeal');
    const generalReason = REASONS.find(r => r.value === 'general');

    const withTarget = buildSubmissionCard(reportReason, 'author1', 'текст', { targetId: 'target1' });
    const row = withTarget[1];
    assert.ok(row, 'при targetId должен быть ряд с кнопками');
    assert.deepEqual(
        row.components.map(c => c.toJSON().custom_id),
        ['ticket_punish:target1']
    );

    const appeal = buildSubmissionCard(appealReason, 'author2', 'текст');
    assert.deepEqual(
        appeal[1].components.map(c => c.toJSON().custom_id),
        ['ticket_unpunish:author2']
    );

    const general = buildSubmissionCard(generalReason, 'author3', 'текст');
    assert.equal(general.length, 1, 'без targetId и не-appeal — вообще без ряда кнопок');
});

test('tickets/config load() подставляет дефолты и не путает вложенный reports между вызовами', async () => {
    await withStoreBackup(storeName, async () => {
        await save({ supportRoleId: 'role1', reports: [{ targetUserId: 'u1', createdAt: 1 }] });
        const first = await load();
        assert.equal(first.supportRoleId, 'role1');
        assert.deepEqual(first.reports, [{ targetUserId: 'u1', createdAt: 1 }]);

        // Мутация возвращённого объекта не должна протекать в БД сама по
        // себе (load() каждый раз перечитывает данные заново).
        first.reports.push({ targetUserId: 'u2', createdAt: 2 });
        const second = await load();
        assert.equal(second.reports.length, 1);
    });
});
