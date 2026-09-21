// Общая безопасная логика "найти-или-создать" для каналов/ролей —
// используется всеми scripts/setup-*.js и security/backup.js
// (restoreBackup). Правило одно и то же везде: если уже есть сохранённый
// ID — используем именно этот канал/роль как есть, не переименовывая и не
// пересоздавая, даже если его имя не совпадает с дефолтным/сохранённым в
// бэкапе. Поиск по имени — только запасной вариант, когда ID ещё не
// сохранён (первый запуск скрипта) или объект с этим ID больше не
// существует (реально удалён — тогда это корректный кейс восстановления).
// Без этого правила любой канал/роль, переименованный администратором
// вручную, считался бы "не найденным", и код создавал бы рядом дубликат
// со старым именем — этот же класс бага чинился по отдельности для
// верификации, временных комнат, тикетов и восстановления из бэкапа,
// прежде чем стать общей утилитой здесь.
//
// Если по имени всё равно находится больше одного совпадения (уже
// случившееся дублирование, например из-за гонки двух параллельных
// деплоев) — берём самый старый (по snowflake ID, он же порядок
// создания) как канонический и громко предупреждаем в логе, какие ID
// лишние, чтобы администратор мог их удалить вручную. Раньше здесь был
// произвольный порядок Collection.find() — при следующем запуске мог
// "канонизироваться" другой из дублей, и сохранённый ID прыгал бы между
// ними от раза к разу.

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

// Только поиск, без создания — для каналов, автосоздание которых
// администратор явно отключил (см. scripts/setup-*.js, где вызывается
// вместо findOrCreateChannel). Тот же приём "по ID, иначе по имени/типу/
// родителю", что и в findOrCreateChannel — вынесен сюда, чтобы не
// дублировать логику поиска между двумя функциями.
async function findChannel({ guild, existingId, name, type, parentId }) {
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
    return channel;
}

async function findOrCreateChannel({ guild, existingId, name, type, parentId, createOptions = {} }) {
    const channel = await findChannel({ guild, existingId, name, type, parentId });
    if (channel) return { channel, created: false };

    const created = await guild.channels.create({ name, type, parent: parentId ?? null, ...createOptions });
    return { channel: created, created: true };
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

module.exports = { findChannel, findOrCreateChannel, findOrCreateRole, pickOldest };
