// Общая безопасная логика "найти-или-создать" для всех scripts/setup-*.js.
// Правило одно и то же везде: если уже есть сохранённый ID — используем
// именно этот канал/роль как есть, не переименовывая и не пересоздавая,
// даже если его имя не совпадает с дефолтным. Поиск по имени — только
// запасной вариант для самого первого запуска, когда ID ещё не сохранён.
// Без этого правила любой канал/роль, переименованный администратором
// вручную, при следующем деплое считался бы "не найденным", и скрипт
// создавал бы рядом дубликат с дефолтным именем (или переименовывал бы
// обратно) — этот же класс бага чинился по отдельности для верификации,
// временных комнат и тикетов, прежде чем стать общей утилитой здесь.

async function findOrCreateChannel({ guild, existingId, name, type, parentId, createOptions = {} }) {
    let channel = existingId ? guild.channels.cache.get(existingId) : null;
    if (!channel) {
        channel = guild.channels.cache.find(
            c => c.type === type && c.name === name && (!parentId || c.parentId === parentId)
        );
    }
    if (channel) return { channel, created: false };

    channel = await guild.channels.create({ name, type, parent: parentId ?? null, ...createOptions });
    return { channel, created: true };
}

async function findOrCreateRole({ guild, existingId, name, ...createOptions }) {
    let role = existingId ? guild.roles.cache.get(existingId) : null;
    if (!role) {
        role = guild.roles.cache.find(r => r.name === name);
    }
    if (role) return { role, created: false };

    role = await guild.roles.create({ name, ...createOptions });
    return { role, created: true };
}

module.exports = { findOrCreateChannel, findOrCreateRole };
