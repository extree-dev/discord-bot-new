// Кастомный мут вместо нативного Discord-таймаута (Communication Disabled
// Until). У таймаута есть жёсткое ограничение платформы: пока он
// активен, участник не может нажать ВООБЩЕ НИ ОДНУ кнопку и использовать
// ВООБЩЕ НИ ОДНУ слэш-команду на сервере — то есть не может даже подать
// апелляцию на само наказание в обычном порядке (единственным обходом
// раньше было DM — см. tickets/handlers.js handleAppealDmButton, DM-
// взаимодействия таймаутом не ограничены).
//
// Этот модуль вместо таймаута назначает роль "Muted" с явным запретом
// писать/реагировать/подключаться к голосу почти везде на сервере (см.
// applyMuteOverwrite — категориям проставляется deny-оверрайт при
// провижининге, scripts/setup-roles.js). Discord НЕ блокирует кнопки и
// слэш-команды по одному только отсутствию этих прав, поэтому участник
// по-прежнему может: открыть тикет апелляции с общей панели, писать в
// своём же треде (членство в приватном треде само по себе даёт доступ,
// независимо от прав родительского канала — на этом уже держится вся
// система тикетов: автор без доступа к панельному каналу свободно
// работает в своём треде) и подключиться к голосовому каналу, который
// staff создаст конкретно под его тикет (там уже стоит персональный
// allow-оверрайт — см. tickets/model.js createDiscussionVoiceChannel —
// персональные оверрайты всегда сильнее ролевых).
const { createStore } = require('../utils/pgStore');
const securityConfig = require('../security/config');

const STORE_NAME = 'mutes';
const store = createStore(STORE_NAME, {});

// Набор прав, которые roleMuted запрещает — только "говорить" (текст,
// реакции, голос), НЕ ViewChannel (участник должен по-прежнему видеть
// сервер, чтобы понимать контекст своей апелляции) и НЕ
// UseApplicationCommands/кнопки (в этом и была вся суть замены таймаута).
const MUTE_DENY_OVERWRITE = {
    SendMessages: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    AddReactions: false,
    Speak: false,
    Connect: false,
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
// (scripts/setup-roles.js — по всем существующим категориям), и на
// каждую новую категорию/канал без родителя, которую создают уже после
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
async function unmuteMember(guild, userId, { auto = false } = {}) {
    const role = await getMutedRole(guild);
    const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
    if (member && role) {
        await member.roles.remove(role, auto ? 'Срок мута истёк' : 'Мут снят вручную').catch(() => {});
    }
    await store.update(data => {
        delete data[muteKey(guild.id, userId)];
    });
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
