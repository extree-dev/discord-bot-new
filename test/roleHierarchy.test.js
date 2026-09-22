const test = require('node:test');
const assert = require('node:assert/strict');
const {
    findDuplicateRoleNames,
    findRolesAboveOrAtBot,
    findDangerousEveryonePermissions,
    computeManagedRoleDrift,
    computeReorganizedPositions,
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

test('computeReorganizedPositions: собирает управляемый блок и низ, сохраняя порядок нетронутых ролей между ними', () => {
    const roles = [
        { id: 'everyone', position: 0, managed: false },
        { id: 'muted', position: 2, managed: false },
        { id: 'tierA', position: 3, managed: false },
        { id: 'trusted', position: 5, managed: false },
        { id: 'tierB', position: 7, managed: false },
        { id: 'support', position: 8, managed: false },
        { id: 'mod', position: 10, managed: false },
        { id: 'bot', position: 20, managed: true },
    ];
    const updates = computeReorganizedPositions({
        roles,
        anchorId: 'mod',
        managedOrderIds: ['tierA', 'tierB'],
        bottomOrderIds: ['trusted', 'muted'],
        everyoneId: 'everyone',
    });
    assert.deepEqual(
        updates.sort((a, b) => b.position - a.position),
        [
            { roleId: 'tierA', position: 9 },
            { roleId: 'tierB', position: 8 },
            { roleId: 'support', position: 7 },
            { roleId: 'trusted', position: 6 },
            { roleId: 'muted', position: 5 },
        ]
    );
});

test('computeReorganizedPositions: уже верная раскладка — пустой результат', () => {
    const roles = [
        { id: 'everyone', position: 0, managed: false },
        { id: 'muted', position: 6, managed: false },
        { id: 'trusted', position: 7, managed: false },
        { id: 'tierB', position: 8, managed: false },
        { id: 'tierA', position: 9, managed: false },
        { id: 'mod', position: 10, managed: false },
    ];
    const updates = computeReorganizedPositions({
        roles,
        anchorId: 'mod',
        managedOrderIds: ['tierA', 'tierB'],
        bottomOrderIds: ['trusted', 'muted'],
        everyoneId: 'everyone',
    });
    assert.deepEqual(updates, []);
});

test('computeReorganizedPositions: отсутствующая управляемая роль пропускается, не ломает нумерацию остальных', () => {
    const roles = [
        { id: 'everyone', position: 0, managed: false },
        { id: 'tierA', position: 3, managed: false },
        { id: 'mod', position: 10, managed: false },
    ];
    const updates = computeReorganizedPositions({
        roles,
        anchorId: 'mod',
        managedOrderIds: ['tierA', 'missing-tier'],
        bottomOrderIds: [],
        everyoneId: 'everyone',
    });
    assert.deepEqual(updates, [{ roleId: 'tierA', position: 9 }]);
});

test('computeReorganizedPositions: анкер не найден — null', () => {
    const roles = [{ id: 'everyone', position: 0, managed: false }];
    assert.equal(
        computeReorganizedPositions({
            roles,
            anchorId: 'missing-anchor',
            managedOrderIds: [],
            bottomOrderIds: [],
            everyoneId: 'everyone',
        }),
        null
    );
});
