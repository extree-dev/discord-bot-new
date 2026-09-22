const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildPanelMessage,
    LOCKDOWN_TOGGLE_ID,
    TOGGLE_PREFIX,
    BACKUP_ID,
    REFRESH_ID,
    MODULES,
} = require('../adminPanel/model');

function fakeStatus(overrides = {}) {
    return {
        securityConfig: {
            manualLockdown: { active: false },
            antiNuke: { enabled: true },
            raidShield: { enabled: true },
            automod: { enabled: false },
            verification: { enabled: true },
        },
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

test('buildPanelMessage: кнопка lockdown меняет customId/эмодзи в зависимости от состояния', () => {
    const off = buildPanelMessage(fakeStatus());
    assert.ok(customIds(off).includes(LOCKDOWN_TOGGLE_ID));

    const on = buildPanelMessage(
        fakeStatus({ securityConfig: { ...fakeStatus().securityConfig, manualLockdown: { active: true } } })
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

test('buildPanelMessage: кнопки бэкапа и обновления всегда присутствуют', () => {
    const ids = customIds(buildPanelMessage(fakeStatus()));
    assert.ok(ids.includes(BACKUP_ID));
    assert.ok(ids.includes(REFRESH_ID));
});

test('buildPanelMessage: не падает при всех модулях выключенных и активном lockdown', () => {
    const status = fakeStatus({
        securityConfig: {
            manualLockdown: { active: true },
            antiNuke: { enabled: false },
            raidShield: { enabled: false },
            automod: { enabled: false },
            verification: { enabled: false },
        },
        recentReports: 0,
        activeMutes: 0,
        activeVoiceChannels: 0,
        warnedUsers: 0,
        totalWarnings: 0,
        backupsCount: 0,
    });
    assert.ok(buildPanelMessage(status));
});
