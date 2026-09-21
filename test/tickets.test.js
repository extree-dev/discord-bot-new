const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const {
    isStaff,
    countRecentReportsOn,
    formatDuration,
    formatReportedUser,
    extractTargetId,
    OPEN_BUTTON_ID,
    buildPanelMessage,
    buildThreadWelcomeMessage,
    buildManagementPanelMessage,
    formatActiveTicketsList,
    formatTicketStats,
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

// message — payload от toMessage(): components[0] — Container, [1] —
// ActionRowBuilder с кнопкой.
function extractButtonCustomIds(message) {
    return message.components.slice(1).flatMap(row => row.components.map(btn => btn.toJSON().custom_id));
}

test('buildPanelMessage: одна кнопка открытия жалобы', () => {
    const ids = extractButtonCustomIds(buildPanelMessage());
    assert.deepEqual(ids, [OPEN_BUTTON_ID]);
});

test('isStaff: пропускает участника с ролью поддержки', () => {
    const config = { supportRoleId: 'support-role' };
    const member = makeMember({ roleIds: ['support-role'] });
    assert.equal(isStaff(config, member), true);
});

test('isStaff: пропускает администратора и модератора даже без роли поддержки', () => {
    const config = { supportRoleId: 'support-role' };
    assert.equal(isStaff(config, makeMember({ isAdmin: true })), true);
    assert.equal(isStaff(config, makeMember({ isModerator: true })), true);
});

test('isStaff: обычный участник без роли и прав — не staff', () => {
    const config = { supportRoleId: 'support-role' };
    assert.equal(isStaff(config, makeMember({})), false);
});

test('extractTargetId: находит чистый ID (снежинку), не находит тег или мусор', () => {
    assert.equal(extractTargetId('354261484395560961'), '354261484395560961');
    assert.equal(extractTargetId('  354261484395560961  '), '354261484395560961');
    assert.equal(extractTargetId('Jerry Smith#6666'), null);
    assert.equal(extractTargetId('123'), null); // слишком коротко для снежинки
    assert.equal(extractTargetId(''), null);
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

test('buildThreadWelcomeMessage: "Закрыть" есть всегда, "Наказать" — только когда targetId резолвится', () => {
    const withTarget = buildThreadWelcomeMessage(
        'author1',
        '354261484395560961',
        '354261484395560961',
        'Tag#0001',
        'текст',
        0
    );
    assert.deepEqual(
        withTarget[1].components.map(c => c.toJSON().custom_id),
        ['ticket_close:author1', 'ticket_punish:354261484395560961']
    );

    const withoutTarget = buildThreadWelcomeMessage('author2', 'Jerry Smith#6666', null, null, 'текст', 0);
    assert.deepEqual(
        withoutTarget[1].components.map(c => c.toJSON().custom_id),
        ['ticket_close:author2']
    );
});

test('buildManagementPanelMessage: кнопки "Активные тикеты" и "Статистика"', () => {
    const ids = extractButtonCustomIds(buildManagementPanelMessage());
    assert.deepEqual(ids, ['ticket_mgmt_list', 'ticket_mgmt_stats']);
});

test('formatActiveTicketsList: список тредов или заглушка, если пусто', () => {
    assert.equal(formatActiveTicketsList([]), 'Открытых тикетов нет.');
    assert.equal(
        formatActiveTicketsList([
            { name: 'ticket-1', url: 'https://discord.com/channels/1/2/3' },
            { name: 'ticket-2', url: 'https://discord.com/channels/1/2/4' },
        ]),
        '• ticket-1 — https://discord.com/channels/1/2/3\n• ticket-2 — https://discord.com/channels/1/2/4'
    );
});

test('formatTicketStats: три строки с числами как есть', () => {
    const text = formatTicketStats({ activeCount: 3, totalCount: 88, reportsCount: 12 });
    assert.match(text, /Открыто сейчас:\*\* 3/);
    assert.match(text, /Всего создано за всё время:\*\* 88/);
    assert.match(text, /Жалоб в истории:\*\* 12/);
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
