const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const {
    isStaff,
    isTrialStaff,
    isSeniorStaff,
    findOpenTicketByOwner,
    findRecentlyClosedTicketByOwner,
    canCloseTicket,
    formatDuration,
    aggregateStats,
    findTicketsToEscalate,
    findTicketsToWarn,
    findTicketsToAutoClose,
    findTicketsToRemindOwner,
    REASONS,
    CANNED_RESPONSES,
    STATUS,
    OPEN_REASON_PREFIX,
    buildPanelMessage,
    buildBugPanelMessage,
    buildTicketControlRow,
    escapeHtml,
    buildHtmlTranscript,
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

// message — payload от toMessage()/toEphemeralMessage(): components[0] —
// Container (заголовок/текст), остальные — ActionRowBuilder с кнопками тем.
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
        assert.equal(typeof r.welcomeMessage, 'string');
        assert.ok(r.welcomeMessage.length > 0, `у темы "${r.value}" нет приветственного сообщения`);
        if (r.staffChecklist) {
            assert.ok(
                Array.isArray(r.staffChecklist) && r.staffChecklist.length > 0,
                `staffChecklist у "${r.value}" пуст`
            );
            for (const step of r.staffChecklist) assert.ok(typeof step === 'string' && step.length > 0);
        }
    }
    const urgent = REASONS.filter(r => r.urgent).map(r => r.value);
    assert.deepEqual(urgent, []);
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

test('CANNED_RESPONSES: у каждого шаблона есть подпись и текст, а их число укладывается в лимит слэш-команды (25 choices)', () => {
    const entries = Object.entries(CANNED_RESPONSES);
    assert.ok(entries.length <= 25, 'addChoices() в /ticket reply не примет больше 25 вариантов');
    for (const [key, canned] of entries) {
        assert.equal(typeof canned.label, 'string', `у шаблона "${key}" нет label`);
        assert.ok(canned.label.length > 0);
        assert.equal(typeof canned.text, 'string', `у шаблона "${key}" нет text`);
        assert.ok(canned.text.length > 0);
    }
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

test('isStaff: пропускает Beta-Support и Beta-Moderator по одному только членству в роли, без Discord-прав', () => {
    // Регрессия: Beta-Support (как и Support) не держит никаких Discord-прав
    // — до фикса isStaff() не знал про betaSupportRoleId и такой участник
    // проваливал проверку целиком, хотя ролью формально был на испытательном
    // сроке в поддержке (баг, из-за которого стажёры не могли работать с
    // тикетами вообще).
    const config = {
        supportRoleId: 'support-role',
        betaSupportRoleId: 'beta-support-role',
        betaModeratorRoleId: 'beta-mod-role',
    };
    assert.equal(isStaff(config, makeMember({ roleIds: ['beta-support-role'] })), true);
    assert.equal(isStaff(config, makeMember({ roleIds: ['beta-mod-role'] })), true);
});

test('isStaff: специалист-роль темы (entry.reasonValue) считается staff только для тикетов своей темы', () => {
    // Разработчик бота должен сам вести весь жизненный цикл баг-тикетов
    // (отдельная система, см. REASONS "bug" standalone) без Support —
    // но это не должно давать ему прав на чужие темы (report/appeal).
    const config = {
        supportRoleId: 'support-role',
        reasonRoleIds: { bug: 'dev-role', report: 'reports-role' },
    };
    const devMember = makeMember({ roleIds: ['dev-role'] });
    assert.equal(isStaff(config, devMember, { reasonValue: 'bug' }), true);
    assert.equal(
        isStaff(config, devMember, { reasonValue: 'report' }),
        false,
        'роль разработчика не даёт доступа к тикетам другой темы'
    );
    assert.equal(isStaff(config, devMember), false, 'без entry специалист-роль темы не учитывается вообще');
    assert.equal(
        isStaff(config, devMember, { reasonValue: 'general' }),
        false,
        'у темы без специалист-роли — тоже нет доступа'
    );
});

test('isTrialStaff: пропускает Beta-Moderator и Beta-Support, но не полноценный Moderator/Support', () => {
    const config = {
        supportRoleId: 'support-role',
        betaModeratorRoleId: 'beta-mod-role',
        betaSupportRoleId: 'beta-support-role',
    };
    assert.equal(isTrialStaff(config, makeMember({ roleIds: ['beta-mod-role'] })), true);
    assert.equal(isTrialStaff(config, makeMember({ roleIds: ['beta-support-role'] })), true);
    assert.equal(isTrialStaff(config, makeMember({ roleIds: ['support-role'] })), false);
    assert.equal(
        isTrialStaff(config, makeMember({ isModerator: true })),
        false,
        'право ModerateMembers само по себе не делает стажёром'
    );
});

test('isTrialStaff: без настроенных beta-ролей в конфиге — никто не стажёр', () => {
    const config = { supportRoleId: 'support-role' };
    assert.equal(isTrialStaff(config, makeMember({ roleIds: ['support-role'] })), false);
});

test('isSeniorStaff: staff без beta-роли — старший состав; стажёр и не-staff — нет', () => {
    const config = {
        supportRoleId: 'support-role',
        betaModeratorRoleId: 'beta-mod-role',
        betaSupportRoleId: 'beta-support-role',
    };
    assert.equal(
        isSeniorStaff(config, makeMember({ roleIds: ['support-role'] })),
        true,
        'полноценный Support — старший'
    );
    assert.equal(isSeniorStaff(config, makeMember({ isModerator: true })), true, 'полноценный Moderator — старший');
    assert.equal(isSeniorStaff(config, makeMember({ isAdmin: true })), true, 'админ — старший');
    assert.equal(
        isSeniorStaff(config, makeMember({ roleIds: ['beta-mod-role'] })),
        false,
        'Beta-Moderator — не старший, даже если isStaff() true'
    );
    assert.equal(
        isSeniorStaff(config, makeMember({ roleIds: ['beta-support-role'] })),
        false,
        'Beta-Support — не старший'
    );
    assert.equal(isSeniorStaff(config, makeMember({})), false, 'обычный участник — не staff вообще');
});

test('findOpenTicketByOwner находит незакрытый тикет по ownerId и возвращает undefined, если такого нет', () => {
    const config = {
        tickets: {
            'thread-1': { ownerId: 'user-1', status: STATUS.OPEN },
            'thread-2': { ownerId: 'user-2', status: STATUS.WAITING_ON_USER },
        },
    };
    const found = findOpenTicketByOwner(config, 'user-2');
    assert.ok(found);
    assert.equal(found[0], 'thread-2');
    assert.equal(found[1].ownerId, 'user-2');

    assert.equal(findOpenTicketByOwner(config, 'no-such-user'), undefined);
});

test('findOpenTicketByOwner игнорирует уже закрытые (RESOLVED) тикеты того же автора', () => {
    const config = {
        tickets: {
            'thread-1': { ownerId: 'user-1', status: STATUS.RESOLVED },
        },
    };
    assert.equal(findOpenTicketByOwner(config, 'user-1'), undefined);
});

test('findRecentlyClosedTicketByOwner находит тикет, закрытый недавно, и не находит после истечения кулдауна или для другого автора', () => {
    const now = 1_000_000;
    const config = {
        tickets: {
            justClosed: { ownerId: 'user-1', status: STATUS.RESOLVED, closedAt: now - 1_000 },
            closedLongAgo: { ownerId: 'user-2', status: STATUS.RESOLVED, closedAt: now - 100_000 },
            stillOpen: { ownerId: 'user-3', status: STATUS.OPEN, closedAt: null },
        },
    };
    const cooldownMs = 5_000;
    const found = findRecentlyClosedTicketByOwner(config, 'user-1', now, cooldownMs);
    assert.ok(found);
    assert.equal(found[0], 'justClosed');

    assert.equal(findRecentlyClosedTicketByOwner(config, 'user-2', now, cooldownMs), undefined);
    assert.equal(findRecentlyClosedTicketByOwner(config, 'user-3', now, cooldownMs), undefined);
    assert.equal(findRecentlyClosedTicketByOwner(config, 'no-such-user', now, cooldownMs), undefined);
});

test('canCloseTicket: незанятый тикет закрывает автор или любой staff', () => {
    const config = { supportRoleId: 'support-role' };
    const entry = { ownerId: 'owner-1', claimedBy: null };
    assert.equal(canCloseTicket(config, entry, makeMember({})), false, 'посторонний — нет');
    assert.equal(canCloseTicket(config, entry, { ...makeMember({}), id: 'owner-1' }), true, 'автор — да');
    assert.equal(canCloseTicket(config, entry, makeMember({ isModerator: true })), true, 'staff — да');
});

test('canCloseTicket: занятый тикет закрывает автор, тот кто взял, или админ — но не любой staff', () => {
    const config = { supportRoleId: 'support-role' };
    const entry = { ownerId: 'owner-1', claimedBy: 'claimer-1' };

    const owner = makeMember({});
    owner.id = 'owner-1';
    assert.equal(canCloseTicket(config, entry, owner), true, 'автор — да');

    const claimer = makeMember({});
    claimer.id = 'claimer-1';
    assert.equal(canCloseTicket(config, entry, claimer), true, 'тот, кто взял — да');

    const admin = makeMember({ isAdmin: true });
    admin.id = 'someone-else';
    assert.equal(canCloseTicket(config, entry, admin), true, 'админ — да');

    const moderator = makeMember({ isModerator: true });
    moderator.id = 'someone-else';
    assert.equal(canCloseTicket(config, entry, moderator), false, 'просто модератор (не админ) — нет');
});

test('formatDuration форматирует миллисекунды в человекочитаемый вид', () => {
    assert.equal(formatDuration(30 * 1000), '<1 мин');
    assert.equal(formatDuration(45 * 60 * 1000), '45 мин');
    assert.equal(formatDuration(2 * 60 * 60 * 1000 + 15 * 60 * 1000), '2 ч 15 мин');
    assert.equal(formatDuration(3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), '3 д 4 ч');
    assert.equal(formatDuration(null), '—');
});

test('aggregateStats считает закрытые тикеты по staff и среднюю оценку', () => {
    const config = {
        tickets: {
            t1: {
                status: STATUS.RESOLVED,
                closedBy: 'staff-1',
                claimedBy: 'staff-1',
                createdAt: 0,
                closedAt: 1000,
                rating: 5,
            },
            t2: {
                status: STATUS.RESOLVED,
                closedBy: 'staff-1',
                claimedBy: 'staff-1',
                createdAt: 0,
                closedAt: 3000,
                rating: 3,
            },
            t3: { status: STATUS.RESOLVED, closedBy: 'staff-2', claimedBy: 'staff-2', createdAt: 0, closedAt: 2000 },
            t4: { status: STATUS.OPEN, closedBy: null, createdAt: 0 },
        },
    };
    const { perStaff, averageRating, ratedCount } = aggregateStats(config);
    assert.equal(perStaff['staff-1'].closed, 2);
    assert.equal(perStaff['staff-1'].totalResolveMs, 4000);
    assert.equal(perStaff['staff-1'].ratedCount, 2);
    assert.equal(perStaff['staff-1'].ratingSum, 8);
    assert.equal(perStaff['staff-2'].closed, 1);
    assert.equal(perStaff['staff-2'].ratedCount, 0);
    assert.equal(ratedCount, 2);
    assert.equal(averageRating, 4);
});

test('aggregateStats относит оценку к claimedBy, а не к closedBy (автор мог закрыть тикет сам)', () => {
    const config = {
        tickets: {
            t1: {
                status: STATUS.RESOLVED,
                closedBy: 'owner-1',
                claimedBy: 'staff-1',
                createdAt: 0,
                closedAt: 1000,
                rating: 4,
            },
        },
    };
    const { perStaff } = aggregateStats(config);
    assert.equal(perStaff['staff-1'].ratedCount, 1);
    assert.equal(perStaff['staff-1'].ratingSum, 4);
    assert.equal(perStaff['staff-1'].closed, 0);
    assert.equal(perStaff['owner-1'].closed, 1);
    assert.equal(perStaff['owner-1'].ratedCount, 0);
});

test('aggregateStats: averageFirstResponseMs считает только тикеты с firstStaffReplyAt', () => {
    const config = {
        tickets: {
            t1: { status: STATUS.RESOLVED, createdAt: 0, firstStaffReplyAt: 1000 },
            t2: { status: STATUS.RESOLVED, createdAt: 0, firstStaffReplyAt: 3000 },
            t3: { status: STATUS.RESOLVED, createdAt: 0, firstStaffReplyAt: null },
            t4: { status: STATUS.OPEN, createdAt: 0, firstStaffReplyAt: 500 },
        },
    };
    const { averageFirstResponseMs } = aggregateStats(config);
    assert.equal(averageFirstResponseMs, 2000);
});

test('aggregateStats: без единого firstStaffReplyAt — averageFirstResponseMs равен null', () => {
    const config = { tickets: { t1: { status: STATUS.RESOLVED, createdAt: 0, firstStaffReplyAt: null } } };
    assert.equal(aggregateStats(config).averageFirstResponseMs, null);
});

test('buildTicketControlRow: без claimedBy показывает "Взять в работу", с claimedBy — "Отпустить"/"Переназначить"', () => {
    const idsOf = rows => rows.flatMap(row => row.components.map(b => b.toJSON().custom_id));

    const unclaimedIds = idsOf(buildTicketControlRow(null));
    assert.ok(unclaimedIds.includes('ticket_claim'));
    assert.ok(!unclaimedIds.includes('ticket_unclaim'));
    assert.ok(!unclaimedIds.includes('ticket_reassign'));

    const claimedIds = idsOf(buildTicketControlRow({ claimedBy: 'staff-1' }));
    assert.ok(claimedIds.includes('ticket_unclaim'));
    assert.ok(claimedIds.includes('ticket_reassign'));
    assert.ok(!claimedIds.includes('ticket_claim'));
});

test('buildTicketControlRow: приоритет и быстрый ответ есть всегда, наказание — только при reportedUserId', () => {
    const idsOf = rows => rows.flatMap(row => row.components.map(b => b.toJSON().custom_id));

    const withoutReport = idsOf(buildTicketControlRow({ claimedBy: 'staff-1' }));
    assert.ok(withoutReport.includes('ticket_priority'));
    assert.ok(withoutReport.includes('ticket_quickreply'));
    assert.ok(!withoutReport.includes('ticket_punish'));

    const withReport = idsOf(buildTicketControlRow({ claimedBy: 'staff-1', reportedUserId: 'user-1' }));
    assert.ok(withReport.includes('ticket_punish'));
});

test('buildTicketControlRow: подпись кнопки приоритета зависит от entry.urgent', () => {
    const labelOf = rows =>
        rows
            .flatMap(row => row.components)
            .find(b => b.toJSON().custom_id === 'ticket_priority')
            .toJSON().label;
    assert.equal(labelOf(buildTicketControlRow({ urgent: false })), 'Приоритет');
    assert.equal(labelOf(buildTicketControlRow({ urgent: true })), 'Снять приоритет');
});

test('escapeHtml: экранирует спецсимволы, не трогает обычный текст', () => {
    assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    assert.equal(escapeHtml("O'Brien & Co"), 'O&#39;Brien &amp; Co');
    assert.equal(escapeHtml('обычный текст'), 'обычный текст');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
});

test('buildHtmlTranscript: экранирует содержимое сообщений — вредоносная разметка не остаётся исполняемой', () => {
    const entry = { number: 1, reason: 'Баг' };
    const messages = [
        {
            createdAt: new Date(0),
            author: { tag: '<img src=x onerror=alert(1)>', displayAvatarURL: () => 'https://example.com/a.png' },
            content: '<script>alert(1)</script>',
            attachments: new Map(),
        },
    ];
    const html = buildHtmlTranscript(entry, messages, '<b>owner</b>');
    assert.ok(!html.includes('<script>alert(1)</script>'), 'сырой script-тег не должен попасть в разметку как есть');
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'ник с HTML-инъекцией должен быть экранирован');
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('Тикет #1'));
});

test('buildHtmlTranscript: пустой список сообщений — валидная страница с заглушкой', () => {
    const html = buildHtmlTranscript({ number: 2, reason: 'Общий' }, [], 'owner#0001');
    assert.ok(html.includes('Сообщений нет.'));
});

test('findTicketsToEscalate: только тред-тикеты без claim, старше claimTimeoutMs и ещё не эскалированные', () => {
    const now = 1_000_000;
    const config = {
        claimTimeoutMs: 10_000,
        tickets: {
            overdue: {
                isThread: true,
                status: STATUS.OPEN,
                claimedBy: null,
                escalatedAt: null,
                createdAt: now - 20_000,
            },
            fresh: { isThread: true, status: STATUS.OPEN, claimedBy: null, escalatedAt: null, createdAt: now - 1_000 },
            claimed: {
                isThread: true,
                status: STATUS.OPEN,
                claimedBy: 'staff',
                escalatedAt: null,
                createdAt: now - 20_000,
            },
            already: {
                isThread: true,
                status: STATUS.OPEN,
                claimedBy: null,
                escalatedAt: now - 5_000,
                createdAt: now - 20_000,
            },
            legacyChannel: {
                isThread: false,
                status: STATUS.OPEN,
                claimedBy: null,
                escalatedAt: null,
                createdAt: now - 20_000,
            },
        },
    };
    const result = findTicketsToEscalate(config, now).map(([id]) => id);
    assert.deepEqual(result, ['overdue']);
});

test('findTicketsToEscalate: срочные тикеты (urgent) эскалируются по urgentClaimTimeoutMs, не claimTimeoutMs', () => {
    const now = 1_000_000;
    const config = {
        claimTimeoutMs: 20_000,
        urgentClaimTimeoutMs: 5_000,
        tickets: {
            urgentOverdue: {
                isThread: true,
                status: STATUS.OPEN,
                claimedBy: null,
                escalatedAt: null,
                urgent: true,
                createdAt: now - 10_000,
            },
            urgentFresh: {
                isThread: true,
                status: STATUS.OPEN,
                claimedBy: null,
                escalatedAt: null,
                urgent: true,
                createdAt: now - 1_000,
            },
            normalNotYetOverdue: {
                isThread: true,
                status: STATUS.OPEN,
                claimedBy: null,
                escalatedAt: null,
                createdAt: now - 10_000,
            },
        },
    };
    const result = findTicketsToEscalate(config, now).map(([id]) => id);
    assert.deepEqual(result, ['urgentOverdue']);
});

test('findTicketsToRemindOwner: только WAITING_ON_USER, не уведомлённые, простаивающие дольше ownerReminderMs', () => {
    const now = 1_000_000;
    const config = {
        ownerReminderMs: 10_000,
        tickets: {
            needsReminder: { status: STATUS.WAITING_ON_USER, ownerNotifiedAt: null, lastActivityAt: now - 20_000 },
            recentlyAnswered: { status: STATUS.WAITING_ON_USER, ownerNotifiedAt: null, lastActivityAt: now - 1_000 },
            alreadyNotified: {
                status: STATUS.WAITING_ON_USER,
                ownerNotifiedAt: now - 1_000,
                lastActivityAt: now - 20_000,
            },
            openStatus: { status: STATUS.OPEN, ownerNotifiedAt: null, lastActivityAt: now - 20_000 },
        },
    };
    assert.deepEqual(
        findTicketsToRemindOwner(config, now).map(([id]) => id),
        ['needsReminder']
    );
});

test('findTicketsToWarn / findTicketsToAutoClose: работают по lastActivityAt/warnedAt', () => {
    const now = 1_000_000;
    const config = {
        inactivityWarnMs: 10_000,
        inactivityCloseMs: 5_000,
        tickets: {
            needsWarn: { status: STATUS.OPEN, warnedAt: null, lastActivityAt: now - 20_000 },
            recentlyActive: { status: STATUS.OPEN, warnedAt: null, lastActivityAt: now - 1_000 },
            alreadyWarned: { status: STATUS.OPEN, warnedAt: now - 1_000, lastActivityAt: now - 20_000 },
            readyToClose: { status: STATUS.OPEN, warnedAt: now - 6_000, lastActivityAt: now - 30_000 },
            resolved: { status: STATUS.RESOLVED, warnedAt: null, lastActivityAt: now - 100_000 },
        },
    };
    assert.deepEqual(
        findTicketsToWarn(config, now).map(([id]) => id),
        ['needsWarn']
    );
    assert.deepEqual(
        findTicketsToAutoClose(config, now).map(([id]) => id),
        ['readyToClose']
    );
});

test('tickets/config load() подставляет дефолты и не путает вложенный tickets между вызовами', async () => {
    await withStoreBackup(storeName, async () => {
        await save({ counter: 5, tickets: { a: { ownerId: 'u1' } } });
        const first = await load();
        assert.equal(first.counter, 5);
        assert.deepEqual(Object.keys(first.tickets), ['a']);

        // Мутация возвращённого объекта не должна протекать в БД сама
        // по себе (load() каждый раз перечитывает данные заново).
        first.tickets.b = { ownerId: 'u2' };
        const second = await load();
        assert.deepEqual(Object.keys(second.tickets), ['a']);
    });
});
