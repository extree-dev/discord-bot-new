const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { isStaff, findTicketByOwner } = require('../tickets/tickets');
const { load, save, filePath } = require('../tickets/config');
const { withBackup } = require('./helpers/withBackup');

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

test('tickets/config load() подставляет дефолты и не путает вложенный tickets между вызовами', async () => {
    await withBackup(filePath, () => {
        save({ counter: 5, tickets: { a: { ownerId: 'u1' } } });
        const first = load();
        assert.equal(first.counter, 5);
        assert.deepEqual(Object.keys(first.tickets), ['a']);

        // Мутация возвращённого объекта не должна протекать в файл сама
        // по себе (load() каждый раз перечитывает файл с диска).
        first.tickets.b = { ownerId: 'u2' };
        const second = load();
        assert.deepEqual(Object.keys(second.tickets), ['a']);
    });
});
