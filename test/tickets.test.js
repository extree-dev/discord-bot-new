const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const {
    isStaff,
    findOpenTicketByOwner,
    canCloseTicket,
    formatDuration,
    aggregateStats,
    findTicketsToEscalate,
    findTicketsToWarn,
    findTicketsToAutoClose,
    STATUS,
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
            t1: { status: STATUS.RESOLVED, closedBy: 'staff-1', createdAt: 0, closedAt: 1000, rating: 5 },
            t2: { status: STATUS.RESOLVED, closedBy: 'staff-1', createdAt: 0, closedAt: 3000, rating: 3 },
            t3: { status: STATUS.RESOLVED, closedBy: 'staff-2', createdAt: 0, closedAt: 2000 },
            t4: { status: STATUS.OPEN, closedBy: null, createdAt: 0 },
        },
    };
    const { perStaff, averageRating, ratedCount } = aggregateStats(config);
    assert.equal(perStaff['staff-1'].closed, 2);
    assert.equal(perStaff['staff-1'].totalResolveMs, 4000);
    assert.equal(perStaff['staff-2'].closed, 1);
    assert.equal(ratedCount, 2);
    assert.equal(averageRating, 4);
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
