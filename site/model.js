// Контент визитки (extree.tech) — раньше жил только в web/site/index.html
// как статичный текст, теперь редактируется через bot.extree.tech/admin
// (dashboard/server.js) и хранится здесь же, где и остальная конфигурация
// бота (bot_stores через utils/pgStore.js), а не в отдельном файле —
// правки не теряются при каждом деплое (deploy.yml делает git reset
// --hard, который стёр бы любые ручные правки в index.html).
const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'site-content';

// Исходный текст статичной визитки (web/site/index.html до перевода на
// БД) — дефолт, пока админка ни разу не сохраняла свою версию.
const DEFAULTS = {
    name: 'Extree',
    role: 'Разработчик Discord-ботов',
    bio: 'Проектирую и веду продакшн-бота для Discord — безопасность, тикеты поддержки, голосовые комнаты, активность участников.',
    links: [
        { label: 'Extree — бот модерации', url: 'https://bot.extree.tech' },
        { label: 'Discord: .extree', url: '' },
    ],
    // Бегущая строка на визитке (pages/visitka): рендерится только пока
    // непусто, поэтому по умолчанию отключена, а не заполнена
    // выдуманными компаниями.
    clients: [],
};

// Форма на /admin отправляет фиксированное число пронумерованных пар
// label/url — больше этого просто не добавить, без JS на добавление
// новых полей это самый простой способ не городить динамический список.
const MAX_LINKS = 5;

// Та же логика, что у MAX_LINKS — ограничивает и форму, и бегущую
// строку на визитке (слишком длинная не нужна ни там, ни там).
const MAX_CLIENTS = 12;

function normalizeLinks(rawLinks) {
    if (!Array.isArray(rawLinks)) return DEFAULTS.links;
    const links = rawLinks
        .filter(l => l && typeof l.label === 'string' && l.label.trim())
        .slice(0, MAX_LINKS)
        .map(l => ({ label: l.label.trim(), url: typeof l.url === 'string' ? l.url.trim() : '' }));
    return links.length ? links : DEFAULTS.links;
}

function normalizeClients(rawClients) {
    if (!Array.isArray(rawClients)) return DEFAULTS.clients;
    return rawClients
        .filter(
            c => c && typeof c.name === 'string' && c.name.trim() && typeof c.logoUrl === 'string' && c.logoUrl.trim()
        )
        .slice(0, MAX_CLIENTS)
        .map(c => ({ name: c.name.trim(), logoUrl: c.logoUrl.trim() }));
}

function normalize(data) {
    return {
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : DEFAULTS.name,
        role: typeof data.role === 'string' ? data.role.trim() : DEFAULTS.role,
        bio: typeof data.bio === 'string' && data.bio.trim() ? data.bio.trim() : DEFAULTS.bio,
        links: normalizeLinks(data.links),
        clients: normalizeClients(data.clients),
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = {
    load: store.load,
    // Форма на /admin шлёт сырые данные — normalize() перед save() нужен,
    // чтобы в БД не оседал мусор (нетримленные пробелы, пустые ссылки),
    // save() сам по себе (utils/pgStore.js) ничего не нормализует.
    save: data => store.save(normalize(data)),
    normalize,
    DEFAULTS,
    MAX_LINKS,
    MAX_CLIENTS,
};
