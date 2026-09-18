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
//
// Если по имени всё равно находится больше одного совпадения (уже
// случившееся дублирование, например из-за гонки двух параллельных
// деплоев) — берём самый старый (по snowflake ID, он же порядок
// создания) как канонический и громко предупреждаем в логе, какие ID
// лишние, чтобы администратор мог их удалить вручную. Раньше здесь был
// произвольный порядок Collection.find() — при следующем деплое мог
// "канонизироваться" другой из дублей, и сохранённый ID прыгал бы между
// ними от деплоя к деплою.

function pickOldest(matches) {
    return matches.slice().sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0))[0];
}

function warnAboutDuplicates(kind, name, matches, canonical) {
    const extraIds = matches.filter(m => m.id !== canonical.id).map(m => m.id);
    console.warn(
        `Найдено ${matches.length} ${kind} с именем "${name}" — использую самый старый (${canonical.id}) как основной. ` +
            `Лишние (можно удалить вручную): ${extraIds.join(', ')}`
    );
}

async function findOrCreateChannel({ guild, existingId, name, type, parentId, createOptions = {} }) {
    let channel = existingId ? guild.channels.cache.get(existingId) : null;
    if (!channel) {
        const matches = [
            ...guild.channels.cache
                .filter(c => c.type === type && c.name === name && (!parentId || c.parentId === parentId))
                .values(),
        ];
        if (matches.length > 1) {
            channel = pickOldest(matches);
            warnAboutDuplicates('каналов', name, matches, channel);
        } else {
            channel = matches[0] ?? null;
        }
    }
    if (channel) return { channel, created: false };

    channel = await guild.channels.create({ name, type, parent: parentId ?? null, ...createOptions });
    return { channel, created: true };
}

async function findOrCreateRole({ guild, existingId, name, ...createOptions }) {
    let role = existingId ? guild.roles.cache.get(existingId) : null;
    if (!role) {
        const matches = [...guild.roles.cache.filter(r => r.name === name).values()];
        if (matches.length > 1) {
            role = pickOldest(matches);
            warnAboutDuplicates('ролей', name, matches, role);
        } else {
            role = matches[0] ?? null;
        }
    }
    if (role) return { role, created: false };

    role = await guild.roles.create({ name, ...createOptions });
    return { role, created: true };
}

module.exports = { findOrCreateChannel, findOrCreateRole };
