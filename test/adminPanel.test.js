const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildPanelMessage,
    buildQuickActionModal,
    buildUndoModal,
    buildStatusDetailEmbed,
    buildBackupListEmbed,
    LOCKDOWN_TOGGLE_ID,
    TOGGLE_PREFIX,
    BACKUP_ID,
    BACKUP_LIST_ID,
    STATUS_DETAIL_ID,
    REFRESH_ID,
    QUICK_ACTION_PREFIX,
    UNDO_ACTION_PREFIX,
    MODULES,
    QUICK_ACTIONS,
    UNDO_ACTIONS,
} = require('../adminPanel/model');

function fakeSecurityConfig(overrides = {}) {
    return {
        manualLockdown: { active: false, channelIds: [] },
        antiNuke: { enabled: true, maxActions: 3, windowMs: 10000 },
        raidShield: { enabled: true, joinThreshold: 8, windowMs: 10000, lockdownMs: 600000 },
        automod: { enabled: false, maxMentions: 5, maxMessagesPerWindow: 6, messageWindowMs: 5000 },
        verification: { enabled: true },
        auditLog: { enabled: true },
        bannedWords: ['a', 'b'],
        logChannelId: '123',
        trustedIds: ['x'],
        trustedRoleId: null,
        ...overrides,
    };
}

function fakeStatus(overrides = {}) {
    return {
        securityConfig: fakeSecurityConfig(),
        recentReports: 2,
        activeMutes: 1,
        activeVoiceChannels: 3,
        warnedUsers: 4,
        totalWarnings: 6,
        backupsCount: 5,
        ...overrides,
    };
}

// Ряды кнопок теперь вложены в сам контейнер (ContainerBuilder
// #addActionRowComponents), а не идут отдельными top-level компонентами
// сообщения — сообщение целиком состоит из одного контейнера.
function containerJSON(message) {
    assert.equal(message.components.length, 1, 'сообщение должно быть ровно одним контейнером');
    return message.components[0].toJSON();
}

function buttonRows(message) {
    return containerJSON(message).components.filter(c => c.type === 1);
}

function customIds(message) {
    return buttonRows(message).flatMap(r => r.components.map(b => b.custom_id));
}

test('buildPanelMessage: 5 рядов кнопок (lockdown, тумблеры, точечные наказания, отмена, действия)', () => {
    const rows = buttonRows(buildPanelMessage(fakeStatus()));
    assert.equal(rows.length, 5);
});

test('buildPanelMessage: все кнопки серые (Secondary), без цветового кодирования', () => {
    const message = buildPanelMessage(fakeStatus());
    const styles = buttonRows(message).flatMap(r => r.components.map(b => b.style));
    assert.ok(
        styles.every(s => s === 2),
        `есть не-серые кнопки: ${styles.join(',')}`
    );
});

test('buildPanelMessage: 5 тумблеров модулей, 4 точечных наказания, 3 отмены, 4 кнопки действий', () => {
    const rows = buttonRows(buildPanelMessage(fakeStatus()));
    assert.equal(rows[1].components.length, 5);
    assert.equal(rows[2].components.length, 4);
    assert.equal(rows[3].components.length, 3);
    assert.equal(rows[4].components.length, 4);
});

test('buildPanelMessage: кнопка lockdown присутствует в обоих состояниях', () => {
    const off = buildPanelMessage(fakeStatus());
    assert.ok(customIds(off).includes(LOCKDOWN_TOGGLE_ID));

    const on = buildPanelMessage(
        fakeStatus({ securityConfig: fakeSecurityConfig({ manualLockdown: { active: true, channelIds: ['c1'] } }) })
    );
    assert.ok(customIds(on).includes(LOCKDOWN_TOGGLE_ID));
});

test('buildPanelMessage: по кнопке на каждый модуль из MODULES с правильным префиксом', () => {
    const ids = customIds(buildPanelMessage(fakeStatus()));
    for (const m of MODULES) {
        assert.ok(ids.includes(`${TOGGLE_PREFIX}${m.key}`), `нет кнопки для ${m.key}`);
    }
});

test('buildPanelMessage: по кнопке на каждое точечное наказание из QUICK_ACTIONS', () => {
    const ids = customIds(buildPanelMessage(fakeStatus()));
    for (const a of QUICK_ACTIONS) {
        assert.ok(ids.includes(`${QUICK_ACTION_PREFIX}${a.key}`), `нет кнопки для ${a.key}`);
    }
});

test('buildPanelMessage: по кнопке на каждую отмену наказания из UNDO_ACTIONS', () => {
    const ids = customIds(buildPanelMessage(fakeStatus()));
    for (const a of UNDO_ACTIONS) {
        assert.ok(ids.includes(`${UNDO_ACTION_PREFIX}${a.key}`), `нет кнопки для ${a.key}`);
    }
});

test('buildPanelMessage: кнопки действий (бэкап/список/статус/обновление) всегда присутствуют', () => {
    const ids = customIds(buildPanelMessage(fakeStatus()));
    assert.ok(ids.includes(BACKUP_ID));
    assert.ok(ids.includes(BACKUP_LIST_ID));
    assert.ok(ids.includes(STATUS_DETAIL_ID));
    assert.ok(ids.includes(REFRESH_ID));
});

test('buildPanelMessage: не падает при всех модулях выключенных и активном lockdown', () => {
    const status = fakeStatus({
        securityConfig: fakeSecurityConfig({
            manualLockdown: { active: true, channelIds: ['c1', 'c2'] },
            antiNuke: { enabled: false, maxActions: 3, windowMs: 10000 },
            raidShield: { enabled: false, joinThreshold: 8, windowMs: 10000, lockdownMs: 600000 },
            automod: { enabled: false, maxMentions: 5, maxMessagesPerWindow: 6, messageWindowMs: 5000 },
            verification: { enabled: false },
            auditLog: { enabled: false },
        }),
        recentReports: 0,
        activeMutes: 0,
        activeVoiceChannels: 0,
        warnedUsers: 0,
        totalWarnings: 0,
        backupsCount: 0,
    });
    assert.ok(buildPanelMessage(status));
});

test('buildQuickActionModal: customId несёт action+targetId, поля различаются по действию', () => {
    const ban = buildQuickActionModal('ban', 'user-1').toJSON();
    assert.equal(ban.custom_id, 'admin_panel_quick_modal:ban:user-1');
    const banFieldIds = ban.components.flatMap(r => r.components.map(c => c.custom_id));
    assert.deepEqual(banFieldIds, ['reason', 'deleteDays']);

    const kick = buildQuickActionModal('kick', 'user-2').toJSON();
    assert.deepEqual(
        kick.components.flatMap(r => r.components.map(c => c.custom_id)),
        ['reason']
    );

    const mute = buildQuickActionModal('mute', 'user-3').toJSON();
    assert.deepEqual(
        mute.components.flatMap(r => r.components.map(c => c.custom_id)),
        ['minutes', 'reason']
    );

    const warn = buildQuickActionModal('warn', 'user-4').toJSON();
    const warnField = warn.components[0].components[0];
    assert.equal(warnField.custom_id, 'reason');
    assert.equal(warnField.required, true);
});

test('buildUndoModal: customId и поле ID пользователя (unban работает по ID, не по выбору участника)', () => {
    const modal = buildUndoModal().toJSON();
    assert.equal(modal.custom_id, 'admin_panel_undo_modal:unban');
    const fieldIds = modal.components.flatMap(r => r.components.map(c => c.custom_id));
    assert.deepEqual(fieldIds, ['userId']);
    assert.equal(modal.components[0].components[0].required, true);
});

test('buildStatusDetailEmbed: не падает с активным и неактивным lockdown', () => {
    assert.ok(buildStatusDetailEmbed(fakeSecurityConfig()));
    assert.ok(buildStatusDetailEmbed(fakeSecurityConfig({ manualLockdown: { active: true, channelIds: ['c1'] } })));
});

test('buildBackupListEmbed: пустой список и непустой не падают', () => {
    assert.ok(buildBackupListEmbed([]));
    assert.ok(buildBackupListEmbed(['backup-1.json', 'backup-2.json']));
});
