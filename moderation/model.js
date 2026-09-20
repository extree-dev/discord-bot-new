// Кастомный мут вместо нативного Discord-таймаута (Communication Disabled
// Until). У таймаута есть жёсткое ограничение платформы: пока он
// активен, участник не может нажать ВООБЩЕ НИ ОДНУ кнопку и использовать
// ВООБЩЕ НИ ОДНУ слэш-команду на сервере — то есть не может даже подать
// апелляцию на само наказание в обычном порядке (единственным обходом
// раньше было DM — см. tickets/handlers.js handleAppealDmButton, DM-
// взаимодействия таймаутом не ограничены).
//
// Этот модуль вместо таймаута назначает роль "Muted" с явным запретом
// писать/реагировать/подключаться к голосу/использовать слэш-команды
// почти везде на сервере (см. applyMuteOverwrite — оверрайт проставляется
// на КАЖДЫЙ канал и категорию при провижининге, scripts/setup-roles.js,
// не только на категории: канальный оверрайт другой роли всегда сильнее
// категорийного запрета Muted — например, если у канала уже есть свой
// собственный allow для какой-то роли, категорийный deny роли Muted его
// не перебьёт, нужен такой же явный запрет прямо на канале). Кнопки и
// модалки (не слэш-команды) Discord не блокирует по этим правам, поэтому
// участник по-прежнему может: открыть тикет апелляции с общей панели и
// подключиться к голосовому каналу, который staff создаст конкретно под
// его тикет (там уже стоит персональный allow-оверрайт — см.
// tickets/model.js createDiscussionVoiceChannel — персональные оверрайты
// всегда сильнее ролевых). Писать в своём же треде тикета Muted-роль по
// умолчанию тоже запрещает (SendMessagesInThreads в общем deny ниже) —
// specifically на панельных каналах тикетов (config.panelChannelId/
// bugPanelChannelId) это отдельно возвращается явным allow-оверрайтом,
// см. scripts/setup-tickets.js.
const { createStore } = require('../utils/pgStore');
const securityConfig = require('../security/config');

const STORE_NAME = 'mutes';
const store = createStore(STORE_NAME, {});

// Набор прав, которые роль Muted запрещает — "говорить" (текст, реакции,
// голос) и использовать слэш-команды. НЕ ViewChannel (участник должен
// по-прежнему видеть сервер, чтобы понимать контекст своей апелляции) и
// НЕ кнопки/модалки — Discord не считает их application-командами, этим
// UseApplicationCommands не мешает открыть тикет апелляции кнопкой с
// панели. UseApplicationCommands добавлен, чтобы замученный не мог
// пользоваться остальными слэш-командами сервера в обход наказания —
// раньше этого не было "потому что кнопки не блокируются", но это
// разные вещи: кнопки не блокируются в любом случае, а слэш-команды как
// раз блокируются этим правом.
const MUTE_DENY_OVERWRITE = {
    SendMessages: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    AddReactions: false,
    Speak: false,
    Connect: false,
    UseApplicationCommands: false,
};

function muteKey(guildId, userId) {
    return `${guildId}_${userId}`;
}

async function getMutedRole(guild) {
    const config = await securityConfig.load();
    const roleId = config.baseRoleIds?.Muted;
    if (!roleId) return null;
    return guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
}

// Ставит deny-оверрайт роли Muted на один канал/категорию — сама по себе
// роль без прав ничего не блокирует (Discord-права ролей только
// выдают, отнять что-то у уже разрешённого может только явный
// канальный/категорийный оверрайт). Используется и разовым провижинингом
// (scripts/setup-roles.js — по ВСЕМ существующим каналам и категориям,
// не только категориям: канальный оверрайт другой роли на конкретном
// канале иначе может перебить категорийный запрет Muted, у Discord
// канальные оверрайты всегда приоритетнее категорийных для одной и той
// же роли), и на каждый новый канал/категорию, которую создают уже после
// настройки (см. index.js register() ниже) — иначе новый канал остался
// бы без ограничения, пока кто-то не перезапустит скрипт вручную.
async function applyMuteOverwrite(channel, mutedRoleId) {
    await channel.permissionOverwrites.edit(mutedRoleId, MUTE_DENY_OVERWRITE).catch(() => {});
}

// Основное наказание — назначает роль, отключает от текущего голосового
// канала (потеря Connect не выкидывает уже подключённого сама по себе —
// это нужно сделать явно) и запоминает время истечения для авто-размута
// (см. moderation/sweep.js). manageable — прежде всего проверка
// иерархии ролей (для .moderatable, который проверяет именно право
// таймаута, здесь смысла нет — назначение роли требует ManageRoles и
// позиции роли бота выше роли участника, это и есть .manageable).
async function muteMember(guild, member, durationMs, reason, mutedById) {
    const role = await getMutedRole(guild);
    if (!role) {
        return { error: 'Роль "Muted" не настроена — запусти scripts/setup-roles.js.' };
    }
    if (!member.manageable) {
        return { error: 'Не могу замутить этого участника (недостаточно прав или роль выше моей).' };
    }
    await member.roles.add(role, reason).catch(() => {});
    await member.voice.disconnect(reason).catch(() => {});

    const expiresAt = Date.now() + durationMs;
    await store.update(data => {
        data[muteKey(guild.id, member.id)] = {
            expiresAt,
            reason,
            mutedBy: mutedById,
            mutedAt: Date.now(),
        };
    });
    return { expiresAt };
}

// auto — вызывается из moderation/sweep.js по истечении срока, отличие
// только в audit-log причине (это уже не решение живого модератора).
// wasMuted в возврате — чтобы вызывающий код (например, кнопка "Снять
// наказание" в тикете-апелляции) мог сообщить, был ли участник вообще
// замучен, а не молча отрапортовать успех в любом случае.
async function unmuteMember(guild, userId, { auto = false } = {}) {
    const role = await getMutedRole(guild);
    const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
    const hadRole = Boolean(role && member?.roles.cache.has(role.id));
    if (member && role) {
        await member.roles.remove(role, auto ? 'Срок мута истёк' : 'Мут снят вручную').catch(() => {});
    }
    let hadRecord = false;
    await store.update(data => {
        const key = muteKey(guild.id, userId);
        if (data[key]) hadRecord = true;
        delete data[key];
    });
    return { wasMuted: hadRole || hadRecord };
}

// Чистая функция для moderation/sweep.js — принимает уже загруженный
// стор и текущее время, без обращений к Discord API, поэтому легко
// тестируется без моков.
function findExpiredMutes(data, now) {
    return Object.entries(data)
        .map(([key, entry]) => {
            const separatorIndex = key.indexOf('_');
            return { guildId: key.slice(0, separatorIndex), userId: key.slice(separatorIndex + 1), entry };
        })
        .filter(({ entry }) => entry.expiresAt <= now);
}

module.exports = {
    load: store.load,
    muteMember,
    unmuteMember,
    getMutedRole,
    applyMuteOverwrite,
    findExpiredMutes,
    storeName: STORE_NAME,
};
