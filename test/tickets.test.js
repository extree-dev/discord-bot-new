const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { isStaff, findTicketByOwner, canCloseTicket } = require('../tickets/model');
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

test('findTicketByOwner находит тикет по ownerId и возвращает undefined, если тикета нет', () => {
    const config = {
        tickets: {
            'channel-1': { ownerId: 'user-1' },
            'channel-2': { ownerId: 'user-2' },
        },
    };
    const found = findTicketByOwner(config, 'user-2');
    assert.ok(found);
    assert.equal(found[0], 'channel-2');
    assert.equal(found[1].ownerId, 'user-2');

    assert.equal(findTicketByOwner(config, 'no-such-user'), undefined);
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
