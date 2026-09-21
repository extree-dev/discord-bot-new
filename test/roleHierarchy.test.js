const test = require('node:test');
const assert = require('node:assert/strict');
const {
    findDuplicateRoleNames,
    findRolesAboveOrAtBot,
    findDangerousEveryonePermissions,
    computeManagedRoleDrift,
} = require('../utils/roleHierarchy');

test('findDuplicateRoleNames: находит группы ролей с одинаковым именем без учёта регистра/пробелов', () => {
    const roles = [
        { id: '1', name: 'Admin' },
        { id: '2', name: ' admin ' },
        { id: '3', name: 'Moderator' },
    ];
    const groups = findDuplicateRoleNames(roles);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].map(r => r.id).sort(), ['1', '2']);
});

test('findDuplicateRoleNames: без дублей — пустой результат', () => {
    assert.deepEqual(findDuplicateRoleNames([{ id: '1', name: 'Admin' }]), []);
});

test('findRolesAboveOrAtBot: находит немassignable роли на уровне бота или выше, игнорирует @everyone и managed', () => {
    const roles = [
        // Роль самого бота — всегда managed: true (заводится Discord
        // автоматически для любого приложения-бота), поэтому её саму
        // findRolesAboveOrAtBot никогда не должна засчитывать находкой,
        // хотя её position всегда равна botPosition.
        { id: 'bot', name: 'Bot', position: 10, managed: true, everyone: false },
        { id: 'above', name: 'Above', position: 15, managed: false, everyone: false },
        { id: 'same', name: 'Same', position: 10, managed: false, everyone: false },
        { id: 'below', name: 'Below', position: 5, managed: false, everyone: false },
        { id: 'integration', name: 'Integration', position: 20, managed: true, everyone: false },
        { id: 'everyone', name: '@everyone', position: 0, managed: false, everyone: true },
    ];
    const result = findRolesAboveOrAtBot(roles, 10);
    assert.deepEqual(result.map(r => r.id).sort(), ['above', 'same']);
});

test('findDangerousEveryonePermissions: находит только опасные права из списка', () => {
    const everyoneRole = { permissions: ['Administrator', 'SendMessages', 'BanMembers'] };
    assert.deepEqual(findDangerousEveryonePermissions(everyoneRole).sort(), ['Administrator', 'BanMembers']);
    assert.deepEqual(findDangerousEveryonePermissions({ permissions: ['SendMessages'] }), []);
});

test('computeManagedRoleDrift: находит роли не на канонической позиции, пропускает отсутствующие и корректные', () => {
    const canonicalOrderIds = ['mod', 'beta-mod', undefined, 'muted'];
    const currentPositionsById = { mod: 5, 'beta-mod': 3, muted: 1 };
    const botPosition = 10;
    // Позиции считаются от индекса в canonicalOrderIds, а не после
    // вычёркивания пропущенных: mod (i=0) -> 9, beta-mod (i=1) -> 8,
    // третий элемент (i=2) отсутствует и пропускается, muted (i=3) -> 6.
    const drift = computeManagedRoleDrift(canonicalOrderIds, currentPositionsById, botPosition);
    assert.deepEqual(
        drift.sort((a, b) => a.roleId.localeCompare(b.roleId)),
        [
            { roleId: 'beta-mod', position: 8 },
            { roleId: 'mod', position: 9 },
            { roleId: 'muted', position: 6 },
        ]
    );
});

test('computeManagedRoleDrift: уже на месте — пустой результат', () => {
    const canonicalOrderIds = ['mod'];
    const currentPositionsById = { mod: 9 };
    assert.deepEqual(computeManagedRoleDrift(canonicalOrderIds, currentPositionsById, 10), []);
});
