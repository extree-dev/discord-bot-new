const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const {
    isStaff,
    isSeniorStaff,
    countRecentReportsOn,
    formatDuration,
    formatReportedUser,
    extractTargetId,
    resolveTargetByUsername,
    OPEN_BUTTON_ID,
    MGMT_SELECT_ID,
    MGMT_CLAIM_PREFIX,
    MGMT_CLOSE_PREFIX,
    MGMT_APPROVE_CLOSE_PREFIX,
    MGMT_DENY_CLOSE_PREFIX,
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

function makeMember({ roleIds = [], isAdmin = false, isModerator = false, canBan = false }) {
    return {
        roles: { cache: new Set(roleIds) },
        permissions: {
            has(flag) {
                if (isAdmin) return true;
                if (isModerator && flag === PermissionFlagsBits.ModerateMembers) return true;
                if (canBan && flag === PermissionFlagsBits.BanMembers) return true;
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

test('isStaff: пропускает участника с ролью Beta-Support', () => {
    const config = { supportRoleId: 'support-role', betaSupportRoleId: 'beta-support-role' };
    const member = makeMember({ roleIds: ['beta-support-role'] });
    assert.equal(isStaff(config, member), true);
});

test('isStaff: обычный участник без роли и прав — не staff', () => {
    const config = { supportRoleId: 'support-role' };
    assert.equal(isStaff(config, makeMember({})), false);
});

test('isSeniorStaff: админ, "полный" модератор (BanMembers) и Support — старший состав', () => {
    const config = { supportRoleId: 'support-role' };
    assert.equal(isSeniorStaff(config, makeMember({ isAdmin: true })), true);
    assert.equal(isSeniorStaff(config, makeMember({ isModerator: true, canBan: true })), true);
    assert.equal(isSeniorStaff(config, makeMember({ roleIds: ['support-role'] })), true);
});

test('isSeniorStaff: бета-модератор/бета-саппорт (ModerateMembers без BanMembers) — не старший состав', () => {
    const config = { supportRoleId: 'support-role', betaSupportRoleId: 'beta-support-role' };
    assert.equal(isSeniorStaff(config, makeMember({ isModerator: true })), false);
    assert.equal(isSeniorStaff(config, makeMember({ roleIds: ['beta-support-role'] })), false);
});

test('extractTargetId: находит чистый ID (снежинку) и настоящее упоминание <@id>, не находит тег или мусор', () => {
    assert.equal(extractTargetId('354261484395560961'), '354261484395560961');
    assert.equal(extractTargetId('  354261484395560961  '), '354261484395560961');
    assert.equal(extractTargetId('<@354261484395560961>'), '354261484395560961');
    assert.equal(extractTargetId('<@!354261484395560961>'), '354261484395560961');
    assert.equal(extractTargetId('Jerry Smith#6666'), null);
    assert.equal(extractTargetId('@.extree'), null);
    assert.equal(extractTargetId('123'), null); // слишком коротко для снежинки
    assert.equal(extractTargetId(''), null);
});

function makeGuildWithMembers(members) {
    return {
        members: {
            fetch: async ({ query }) => {
                const q = query.toLowerCase();
                // Настоящий Discord Search Guild Members ищет по префиксу
                // username/nickname, не по отображаемому имени (globalName)
                // — если оно совпадает точно, это подтверждение уже
                // найденного по префиксу участника, а не отдельный канал
                // поиска (см. exactMatches ниже).
                const matches = members.filter(
                    m => m.user.username.toLowerCase().startsWith(q) || (m.nickname ?? '').toLowerCase().startsWith(q)
                );
                return new Map(matches.map(m => [m.id, m]));
            },
        },
    };
}

test('resolveTargetByUsername: чистит "@.ник"/"ник#1234" и резолвит по точному совпадению username', async () => {
    const guild = makeGuildWithMembers([
        { id: '1', user: { username: 'extree', tag: 'extree', globalName: null }, nickname: null },
    ]);
    const byAtDot = await resolveTargetByUsername(guild, '@.extree');
    assert.equal(byAtDot?.id, '1');

    const byAt = await resolveTargetByUsername(guild, '@extree');
    assert.equal(byAt?.id, '1');

    const byTag = await resolveTargetByUsername(guild, 'Extree#8223');
    assert.equal(byTag?.id, '1');
});

test('resolveTargetByUsername: не гадает при 0 или нескольких точных совпадениях', async () => {
    const noMatch = makeGuildWithMembers([
        { id: '1', user: { username: 'someoneelse', tag: 'someoneelse', globalName: null }, nickname: null },
    ]);
    assert.equal(await resolveTargetByUsername(noMatch, '@extree'), null);

    const ambiguous = makeGuildWithMembers([
        { id: '1', user: { username: 'extree', tag: 'extree', globalName: null }, nickname: null },
        { id: '2', user: { username: 'extreee', tag: 'extreee', globalName: 'extree' }, nickname: null },
    ]);
    assert.equal(await resolveTargetByUsername(ambiguous, '@extree'), null);
});

test('resolveTargetByUsername: точное совпадение по nickname/globalName тоже засчитывается', async () => {
    const byNickname = makeGuildWithMembers([
        { id: '1', user: { username: 'randomname123', tag: 'randomname123', globalName: null }, nickname: 'Extree' },
    ]);
    assert.equal((await resolveTargetByUsername(byNickname, '@extree'))?.id, '1');

    // username matches только по префиксу ("extree_official" начинается
    // на "extree", но не равен) — точное совпадение подтверждается через
    // globalName, а не username.
    const byGlobalName = makeGuildWithMembers([
        {
            id: '1',
            user: { username: 'extree_official', tag: 'extree_official', globalName: 'Extree' },
            nickname: null,
        },
    ]);
    assert.equal((await resolveTargetByUsername(byGlobalName, '@extree'))?.id, '1');
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

test('formatTicketDetail: без резолвящегося targetId показывает сырой введённый текст', () => {
    const text = formatTicketDetail({
        number: 6,
        authorId: 'u1',
        targetId: null,
        targetTag: null,
        rawTarget: 'Jerry Smith#6666',
        claimedByTag: null,
    });
    assert.match(text, /`Jerry Smith#6666`/);
});

test('formatTicketDetail: без targetId и rawTarget — просто прочерк', () => {
    const text = formatTicketDetail({ number: 7, authorId: 'u1', targetId: null, targetTag: null, claimedByTag: null });
    assert.match(text, /нарушителя:\*\* —/);
});

test('formatTicketDetail: показывает, кто запросил закрытие, если есть pendingClose', () => {
    const text = formatTicketDetail({
        number: 8,
        authorId: 'u1',
        targetId: null,
        targetTag: null,
        claimedByTag: 'Beta#0001',
        pendingClose: { requestedBy: 'u2', requestedByTag: 'Beta#0001' },
    });
    assert.match(text, /Beta#0001/);
    assert.match(text, /Запрос на закрытие/);
});

test('buildTicketActionRow: "Взять в работу" только пока не взят, "Наказать" — только если есть targetId', () => {
    const unclaimed = buildTicketActionRow('thread1', { claimedBy: null, targetId: '354261484395560961' }, false);
    assert.deepEqual(
        unclaimed.components.map(c => c.toJSON().custom_id),
        [`${MGMT_CLAIM_PREFIX}thread1`, `${MGMT_CLOSE_PREFIX}thread1`, 'ticket_punish:354261484395560961']
    );

    const claimed = buildTicketActionRow('thread2', { claimedBy: 'staff1', targetId: null }, false);
    assert.deepEqual(
        claimed.components.map(c => c.toJSON().custom_id),
        [`${MGMT_CLOSE_PREFIX}thread2`]
    );
});

test('buildTicketActionRow: стажёр видит "Запросить закрытие", старший состав — "Закрыть"', () => {
    const trialRow = buildTicketActionRow('thread1', { claimedBy: 'staff1', targetId: null }, false);
    assert.equal(trialRow.components[0].toJSON().label, 'Запросить закрытие');

    const seniorRow = buildTicketActionRow('thread1', { claimedBy: 'staff1', targetId: null }, true);
    assert.equal(seniorRow.components[0].toJSON().label, 'Закрыть');
});

test('buildTicketActionRow: с pendingClose стажёр видит задизейбленную кнопку, старший — подтвердить/отклонить', () => {
    const record = { claimedBy: 'staff1', targetId: null, pendingClose: { requestedBy: 'staff1' } };

    const trialRow = buildTicketActionRow('thread1', record, false);
    const trialButton = trialRow.components[0].toJSON();
    assert.equal(trialButton.custom_id, `${MGMT_CLOSE_PREFIX}thread1`);
    assert.equal(trialButton.disabled, true);

    const seniorRow = buildTicketActionRow('thread1', record, true);
    assert.deepEqual(
        seniorRow.components.map(c => c.toJSON().custom_id),
        [`${MGMT_APPROVE_CLOSE_PREFIX}thread1`, `${MGMT_DENY_CLOSE_PREFIX}thread1`]
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

test('formatActiveTicketsList: помечает тикеты с запросом на закрытие', () => {
    const text = formatActiveTicketsList([
        { name: 'ticket-3', url: 'https://discord.com/channels/1/2/5', claimedByTag: 'Mod#0001', pendingClose: true },
    ]);
    assert.match(text, /⏳ запрошено закрытие/);
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
