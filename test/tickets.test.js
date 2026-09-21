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
    MGMT_SELECT_ID,
    MGMT_CLAIM_PREFIX,
    MGMT_CLOSE_PREFIX,
    buildPanelMessage,
    buildThreadWelcomeMessage,
    buildManagementPanelMessage,
    buildTicketSelectRow,
    formatTicketDetail,
    buildTicketActionRow,
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

test('buildPanelMessage: одна кнопка "Жалоба на игрока"', () => {
    const message = buildPanelMessage();
    assert.deepEqual(extractButtonCustomIds(message), [OPEN_BUTTON_ID]);
    const button = message.components[1].components[0].toJSON();
    assert.equal(button.label, 'Жалоба на игрока');
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

test('buildThreadWelcomeMessage: только информационный контейнер, без единой кнопки', () => {
    const withTarget = buildThreadWelcomeMessage('354261484395560961', '354261484395560961', 'Tag#0001', 'текст', 0);
    assert.equal(withTarget.length, 1);

    const withoutTarget = buildThreadWelcomeMessage('Jerry Smith#6666', null, null, 'текст', 0);
    assert.equal(withoutTarget.length, 1);
});

test('buildManagementPanelMessage: кнопки "Активные тикеты" и "Статистика"', () => {
    const ids = extractButtonCustomIds(buildManagementPanelMessage());
    assert.deepEqual(ids, ['ticket_mgmt_list', 'ticket_mgmt_stats']);
});

test('buildTicketSelectRow: опции по активным тикетам, не больше 25', () => {
    const tickets = [
        { id: 't1', name: 'ticket-1', claimedByTag: null },
        { id: 't2', name: 'ticket-2', claimedByTag: 'Mod#0001' },
    ];
    const row = buildTicketSelectRow(tickets);
    const select = row.components[0].toJSON();
    assert.equal(select.custom_id, MGMT_SELECT_ID);
    assert.deepEqual(
        select.options.map(o => [o.value, o.description]),
        [
            ['t1', 'не взят'],
            ['t2', 'взял Mod#0001'],
        ]
    );

    const many = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, name: `ticket-${i}`, claimedByTag: null }));
    assert.equal(buildTicketSelectRow(many).components[0].toJSON().options.length, 25);
});

test('formatTicketDetail: показывает автора/цель/claim-статус', () => {
    const text = formatTicketDetail({
        number: 5,
        authorId: 'u1',
        targetId: '354261484395560961',
        targetTag: 'Tag#0001',
        claimedByTag: null,
    });
    assert.match(text, /ticket-5/);
    assert.match(text, /`u1`/);
    assert.match(text, /Tag#0001/);
    assert.match(text, /никто/);
});

test('buildTicketActionRow: "Взять в работу"/"Закрыть" всегда, "Наказать" — только если есть targetId', () => {
    const withTarget = buildTicketActionRow('thread1', { targetId: '354261484395560961' });
    assert.deepEqual(
        withTarget.components.map(c => c.toJSON().custom_id),
        [`${MGMT_CLAIM_PREFIX}thread1`, `${MGMT_CLOSE_PREFIX}thread1`, 'ticket_punish:354261484395560961']
    );

    const withoutTarget = buildTicketActionRow('thread2', { targetId: null });
    assert.deepEqual(
        withoutTarget.components.map(c => c.toJSON().custom_id),
        [`${MGMT_CLAIM_PREFIX}thread2`, `${MGMT_CLOSE_PREFIX}thread2`]
    );
});

test('formatActiveTicketsList: список тредов с claim-статусом или заглушка, если пусто', () => {
    assert.equal(formatActiveTicketsList([]), 'Открытых тикетов нет.');
    assert.equal(
        formatActiveTicketsList([
            { name: 'ticket-1', url: 'https://discord.com/channels/1/2/3', claimedByTag: null },
            { name: 'ticket-2', url: 'https://discord.com/channels/1/2/4', claimedByTag: 'Mod#0001' },
        ]),
        '• ticket-1 — https://discord.com/channels/1/2/3 — не взят\n' +
            '• ticket-2 — https://discord.com/channels/1/2/4 — взял Mod#0001'
    );
});

test('formatTicketStats: четыре строки с числами как есть', () => {
    const text = formatTicketStats({ activeCount: 3, unclaimedCount: 2, totalCount: 88, reportsCount: 12 });
    assert.match(text, /Открыто сейчас:\*\* 3/);
    assert.match(text, /Не взято в работу:\*\* 2/);
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

test('tickets/config load() подставляет дефолт для ticketsById и не путает его между вызовами', async () => {
    await withStoreBackup(storeName, async () => {
        await save({ ticketsById: { t1: { number: 1, authorId: 'u1', claimedBy: null } } });
        const first = await load();
        assert.deepEqual(first.ticketsById, { t1: { number: 1, authorId: 'u1', claimedBy: null } });

        first.ticketsById.t2 = { number: 2, authorId: 'u2', claimedBy: null };
        const second = await load();
        assert.deepEqual(Object.keys(second.ticketsById), ['t1']);
    });
});
