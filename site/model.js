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
    // Секция "work" на визитке — та же логика: пусто по умолчанию,
    // секция целиком скрывается, пока админ не добавит хотя бы один
    // проект через /site-admin.
    showcases: [],
};

// Форма на /admin отправляет фиксированное число пронумерованных пар
// label/url — больше этого просто не добавить, без JS на добавление
// новых полей это самый простой способ не городить динамический список.
const MAX_LINKS = 5;

// Та же логика, что у MAX_LINKS — ограничивает и форму, и бегущую
// строку на визитке (слишком длинная не нужна ни там, ни там).
const MAX_CLIENTS = 12;

// Карточек в сетке секции "work" на визитке — та же логика, что у
// MAX_CLIENTS.
const MAX_SHOWCASES = 8;

// Тегов на одну карточку — форма шлёт их списком (через запятую),
// без разумного предела можно случайно забить всю карточку текстом
// вместо тегов.
const MAX_SHOWCASE_TAGS = 6;

// Категории карточек в секции "work" — те же 4 вкладки, что на
// референсе (frdg.work): Tools/Communities/Websites/Branding. Вместо
// отдельных сущностей Tool/Community (они остаются неиспользуемыми
// заготовками в types.ts) все карточки живут в showcases с полем
// category — так форма и рендер на визитке остаются одним и тем же
// кодом для всех 4 вкладок, а не четырьмя похожими CRUD-формами.
const SHOWCASE_CATEGORIES = ['tools', 'communities', 'websites', 'branding'];
const DEFAULT_SHOWCASE_CATEGORY = 'websites';

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
        .map(c => ({
            name: c.name.trim(),
            logoUrl: c.logoUrl.trim(),
            // Необязательное — просто подпись под логотипом ("2024 – Present"),
            // в отличие от name/logoUrl не влияет на то, рендерится ли клиент.
            period: typeof c.period === 'string' ? c.period.trim() : '',
        }));
}

function normalizeShowcases(rawShowcases) {
    if (!Array.isArray(rawShowcases)) return DEFAULTS.showcases;
    return rawShowcases
        .filter(s => s && typeof s.title === 'string' && s.title.trim())
        .slice(0, MAX_SHOWCASES)
        .map(s => ({
            title: s.title.trim(),
            tags: Array.isArray(s.tags)
                ? s.tags
                      .filter(t => typeof t === 'string' && t.trim())
                      .slice(0, MAX_SHOWCASE_TAGS)
                      .map(t => t.trim())
                : [],
            description: typeof s.description === 'string' ? s.description.trim() : '',
            // Как у клиента: URL картинки, пустая строка = карточка без
            // баннера (блок изображения в неё просто не рендерится).
            imageUrl: typeof s.imageUrl === 'string' ? s.imageUrl.trim() : '',
            url: typeof s.url === 'string' ? s.url.trim() : '',
            nda: Boolean(s.nda),
            upcoming: Boolean(s.upcoming),
            category: SHOWCASE_CATEGORIES.includes(s.category) ? s.category : DEFAULT_SHOWCASE_CATEGORY,
        }));
}

function normalize(data) {
    return {
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : DEFAULTS.name,
        role: typeof data.role === 'string' ? data.role.trim() : DEFAULTS.role,
        bio: typeof data.bio === 'string' && data.bio.trim() ? data.bio.trim() : DEFAULTS.bio,
        links: normalizeLinks(data.links),
        clients: normalizeClients(data.clients),
        showcases: normalizeShowcases(data.showcases),
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
    MAX_SHOWCASES,
    MAX_SHOWCASE_TAGS,
    SHOWCASE_CATEGORIES,
};
