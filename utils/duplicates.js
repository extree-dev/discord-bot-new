// Чистая логика для scripts/fix-duplicates.js — вынесена сюда по тому же
// принципу, что utils/roleHierarchy.js для fix-role-hierarchy.js: работает
// с плоскими объектами {id, name, ...}, а не с discord.js Role/Channel,
// чтобы её можно было протестировать без реального клиента. Маппинг из
// guild.roles.cache/guild.channels.cache делает вызывающий скрипт.
const { pickOldest } = require('./idempotent');

// Роли-дубликаты по имени (без учёта регистра/пробелов) — тот же критерий,
// что findDuplicateRoleNames в roleHierarchy.js, но здесь сразу возвращаем
// {canonical, extras} для дальнейшей миграции участников и удаления, а не
// просто группы для отчёта. managed-роли (интеграции/другие боты) и
// @everyone никогда не считаются дублями — их не создаёт ни один из
// scripts/setup-*.js, и удалить их нельзя.
function findDuplicateRoles(roles) {
    const candidates = roles.filter(r => !r.managed && !r.everyone);
    const byName = new Map();
    for (const r of candidates) {
        const key = r.name.trim().toLowerCase();
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(r);
    }
    return [...byName.values()]
        .filter(group => group.length > 1)
        .map(group => {
            const canonical = pickOldest(group);
            return { canonical, extras: group.filter(r => r.id !== canonical.id) };
        });
}

// Каналы/категории-дубликаты: тот же тип + тот же родитель + то же имя без
// учёта регистра/пробелов — ровно то, что findOrCreateChannel ищет при
// провижининге (см. utils/idempotent.js), просто здесь сравниваем уже
// существующие каналы между собой, а не с одним желаемым именем.
function findDuplicateChannels(channels) {
    const byKey = new Map();
    for (const c of channels) {
        const key = `${c.type}:${c.parentId ?? 'root'}:${c.name.trim().toLowerCase()}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(c);
    }
    return [...byKey.values()]
        .filter(group => group.length > 1)
        .map(group => {
            const canonical = pickOldest(group);
            return { canonical, extras: group.filter(c => c.id !== canonical.id) };
        });
}

// Из всех найденных групп дублей (роли + каналы вместе) строит карту
// "устаревший ID -> канонический ID" — дальше применяется ко всем
// config-сторам фич, чтобы ссылки не остались висеть на удалённых дублях.
function buildIdReplacementMap(duplicateGroups) {
    const map = new Map();
    for (const { canonical, extras } of duplicateGroups) {
        for (const extra of extras) map.set(extra.id, canonical.id);
    }
    return map;
}

// Рекурсивно заменяет строковые значения по карте ID — ключи объектов не
// трогает (там либо не ID вообще, либо составные ключи вроде
// "guildId_userId" в leveling/config.js, которые с чистым snowflake всё
// равно не совпадут). Возвращает новый объект/массив, исходный value не
// мутирует — вызывающий код сам решает, что делать с результатом (см.
// scripts/fix-duplicates.js: Object.assign внутри mutate для store.update()).
function replaceIdsDeep(value, idMap) {
    if (typeof value === 'string') return idMap.has(value) ? idMap.get(value) : value;
    if (Array.isArray(value)) return value.map(v => replaceIdsDeep(v, idMap));
    if (value && typeof value === 'object') {
        const result = {};
        for (const [key, v] of Object.entries(value)) result[key] = replaceIdsDeep(v, idMap);
        return result;
    }
    return value;
}

module.exports = { findDuplicateRoles, findDuplicateChannels, buildIdReplacementMap, replaceIdsDeep };
