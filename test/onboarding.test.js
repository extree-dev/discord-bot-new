const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('@discordjs/collection');
const { buildOnboardingMessage, PREFIX } = require('../adminPanel/onboarding');

function fakeChannel(id, name) {
    return { id, name };
}

function fakeOption(id, title, description, channelList) {
    return {
        id,
        title,
        description,
        channels: new Collection(channelList.map(c => [c.id, c])),
        roles: new Collection(),
    };
}

function fakePrompt(id, title, required, options) {
    return {
        id,
        title,
        required,
        singleSelect: true,
        inOnboarding: true,
        type: 0,
        options: new Collection(options.map(o => [o.id, o])),
    };
}

function fakeOnboarding(overrides = {}) {
    return {
        enabled: true,
        mode: 1,
        defaultChannels: new Collection(),
        prompts: new Collection(),
        ...overrides,
    };
}

function container(message) {
    assert.equal(message.components.length, 1, 'сообщение должно быть ровно одним контейнером');
    return message.components[0].toJSON();
}

function buttonRows(message) {
    return container(message).components.filter(c => c.type === 1);
}

function customIds(message) {
    return buttonRows(message).flatMap(r => r.components.map(b => b.custom_id));
}

test('buildOnboardingMessage: не падает на пустой адаптации (без вопросов и каналов)', () => {
    assert.ok(buildOnboardingMessage(fakeOnboarding()));
});

test('buildOnboardingMessage: 2 ряда кнопок (переключатели, редактирование), все серые', () => {
    const message = buildOnboardingMessage(fakeOnboarding());
    const rows = buttonRows(message);
    assert.equal(rows.length, 2);
    const styles = rows.flatMap(r => r.components.map(b => b.style));
    assert.ok(styles.every(s => s === 2));
});

test('buildOnboardingMessage: подпись кнопки toggle отражает текущее состояние', () => {
    const enabledIds = customIds(buildOnboardingMessage(fakeOnboarding({ enabled: true })));
    const disabledIds = customIds(buildOnboardingMessage(fakeOnboarding({ enabled: false })));
    assert.ok(enabledIds.includes(`${PREFIX}toggle`));
    assert.ok(disabledIds.includes(`${PREFIX}toggle`));

    const enabledLabel = buttonRows(buildOnboardingMessage(fakeOnboarding({ enabled: true })))[0].components[0].label;
    const disabledLabel = buttonRows(buildOnboardingMessage(fakeOnboarding({ enabled: false })))[0].components[0].label;
    assert.equal(enabledLabel, 'Выключить');
    assert.equal(disabledLabel, 'Включить');
});

test('buildOnboardingMessage: текст перечисляет вопросы, их опции и целевые каналы', () => {
    const rules = fakeChannel('1', 'rules');
    const verification = fakeChannel('2', 'verification');

    const onboarding = fakeOnboarding({
        defaultChannels: new Collection([[rules.id, rules]]),
        prompts: new Collection([
            [
                'p1',
                fakePrompt('p1', 'С чего начать', true, [
                    fakeOption('o1', 'Правила сервера', 'Прочитай перед началом', [rules]),
                    fakeOption('o2', 'Верификация', null, [verification]),
                ]),
            ],
        ]),
    });

    const message = buildOnboardingMessage(onboarding);
    const text = message.components[0]
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');

    assert.match(text, /С чего начать/);
    assert.match(text, /обязателен/);
    assert.match(text, /Правила сервера/);
    assert.match(text, /<#1>/);
    assert.match(text, /<#2>/);
});

test('buildOnboardingMessage: вопросов нет — показывает заглушку, а не падает', () => {
    const message = buildOnboardingMessage(fakeOnboarding());
    const text = message.components[0]
        .toJSON()
        .components.filter(c => c.type === 10)
        .map(c => c.content)
        .join('\n');
    assert.match(text, /Вопросов пока нет/);
});
