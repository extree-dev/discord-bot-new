// Исполнители точечных наказаний с панели администратора — та же логика,
// что в commands/moderation/{ban,kick,timeout,warn}.js, только вызывается
// из handlers.js после select+modal, а не из execute() слэш-команды.
// Дублирование сознательное: фичи в этом боте не тянут зависимости друг
// на друга (см. аналогичные комментарии в leveling/ideaQueue), а сами
// команды трогать рискованно — они уже стабильны и покрывают тот же
// функционал независимым путём.
const moderation = require('../moderation');
const { addWarning, clearWarnings } = require('../utils/warnings');
const { notifyPunishment } = require('../utils/punishmentNotice');

async function applyBan(guild, target, reason, deleteDays) {
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (member && !member.bannable) {
        return { error: 'Не могу забанить этого участника (недостаточно прав или роль выше моей).' };
    }
    await guild.members.ban(target.id, { deleteMessageSeconds: deleteDays * 24 * 60 * 60, reason });
    return { ok: true };
}

async function applyKick(guild, target, reason) {
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) return { error: 'Не удалось найти этого участника на сервере.' };
    if (!member.kickable) {
        return { error: 'Не могу кикнуть этого участника (недостаточно прав или роль выше моей).' };
    }
    await member.kick(reason);
    return { ok: true };
}

async function applyMute(guild, target, reason, minutes, moderatorId) {
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) return { error: 'Не удалось найти этого участника на сервере.' };

    const muteResult = await moderation.muteMember(guild, member, minutes * 60 * 1000, reason, moderatorId);
    if (muteResult.error) return { error: muteResult.error };

    await notifyPunishment(target, guild, { kind: 'timeout', reason, durationLabel: `${minutes} мин.` });
    return { ok: true };
}

async function applyWarn(guild, target, reason, moderatorTag) {
    const list = await addWarning(guild.id, target.id, reason, moderatorTag);
    await notifyPunishment(target, guild, { kind: 'warn', reason });
    return { ok: true, count: list.length };
}

// Отмены — та же логика, что у /unban, /timeout minutes:0 и /warnings
// clear:true: не требуют причины и не проверяют, было ли наказание
// вообще активно (снятие того, чего нет — не ошибка, см. те же команды).
async function applyUnban(guild, userId) {
    const bans = await guild.bans.fetch();
    if (!bans.has(userId)) return { error: 'Этот пользователь не забанен.' };
    await guild.members.unban(userId);
    return { ok: true };
}

async function applyUnmute(guild, target) {
    await moderation.unmuteMember(guild, target.id);
    return { ok: true };
}

async function applyClearWarnings(guild, target) {
    await clearWarnings(guild.id, target.id);
    return { ok: true };
}

module.exports = { applyBan, applyKick, applyMute, applyWarn, applyUnban, applyUnmute, applyClearWarnings };
