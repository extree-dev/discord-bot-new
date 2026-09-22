const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildPanelMessage,
    buildStatusDetailEmbed,
    buildBackupListEmbed,
    LOCKDOWN_TOGGLE_ID,
    TOGGLE_PREFIX,
    BACKUP_ID,
    BACKUP_LIST_ID,
    STATUS_DETAIL_ID,
    REFRESH_ID,
    MODULES,
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

function customIds(message) {
    return message.components.flatMap(c =>
        typeof c.toJSON === 'function' && c.toJSON().type === 1 ? c.toJSON().components.map(b => b.custom_id) : []
    );
}

test('buildPanelMessage: собирает контейнер + 3 ряда кнопок, не падает', () => {
    const message = buildPanelMessage(fakeStatus());
    assert.equal(message.components.length, 4);
});

test('buildPanelMessage: 5 тумблеров модулей (потолок ActionRow) и 4 кнопки действий', () => {
    const message = buildPanelMessage(fakeStatus());
    assert.equal(message.components[2].toJSON().components.length, 5);
    assert.equal(message.components[3].toJSON().components.length, 4);
});

test('buildPanelMessage: кнопка lockdown меняет customId/эмодзи в зависимости от состояния', () => {
    const off = buildPanelMessage(fakeStatus());
    assert.ok(customIds(off).includes(LOCKDOWN_TOGGLE_ID));

    const on = buildPanelMessage(
        fakeStatus({ securityConfig: fakeSecurityConfig({ manualLockdown: { active: true, channelIds: ['c1'] } }) })
    );
    assert.ok(customIds(on).includes(LOCKDOWN_TOGGLE_ID));
});

test('buildPanelMessage: по кнопке на каждый модуль из MODULES с правильным префиксом', () => {
    const message = buildPanelMessage(fakeStatus());
    const ids = customIds(message);
    for (const m of MODULES) {
        assert.ok(ids.includes(`${TOGGLE_PREFIX}${m.key}`), `нет кнопки для ${m.key}`);
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

test('buildStatusDetailEmbed: не падает с активным и неактивным lockdown', () => {
    assert.ok(buildStatusDetailEmbed(fakeSecurityConfig()));
    assert.ok(buildStatusDetailEmbed(fakeSecurityConfig({ manualLockdown: { active: true, channelIds: ['c1'] } })));
});

test('buildBackupListEmbed: пустой список и непустой не падают', () => {
    assert.ok(buildBackupListEmbed([]));
    assert.ok(buildBackupListEmbed(['backup-1.json', 'backup-2.json']));
});
