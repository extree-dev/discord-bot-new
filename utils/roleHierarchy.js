// Чистая логика для scripts/fix-role-hierarchy.js (и переиспользуется
// scripts/audit-roles.js) — вынесена сюда, а не в сам скрипт, чтобы
// можно было протестировать без реального Discord-клиента, как и
// остальные "find*"-функции в проекте (moderation/model.js
// findExpiredMutes, tickets/model.js findTicketsToEscalate и т.п.).
// Работает с плоскими объектами {id, name, position, permissions,
// managed, memberCount, everyone}, а не с discord.js Role — маппинг из
// реального guild.roles.cache делает вызывающий скрипт.

// Права, которые совсем не должны стоять у @everyone — риск для любого
// зашедшего на сервер, а не только неудобство в иерархии. Тот же список,
// что в audit-roles.js.
const DANGEROUS_FOR_EVERYONE = [
    'Administrator',
    'ManageGuild',
    'ManageRoles',
    'ManageChannels',
    'BanMembers',
    'KickMembers',
    'ModerateMembers',
    'ManageWebhooks',
    'MentionEveryone',
];

// Роль считается задвоенной, если её имя (без учёта регистра/пробелов)
// совпадает с другой — самое частое реальное проявление сломанной
// иерархии на этом сервере (см. 3.9.4, задвоение "Администратор" из-за
// бага в /backup restore).
function findDuplicateRoleNames(roles) {
    const byName = new Map();
    for (const r of roles) {
        const key = r.name.trim().toLowerCase();
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(r);
    }
    return [...byName.values()].filter(group => group.length > 1);
}

// Роли на уровне роли бота или выше — бот физически не может ими
// управлять (переставить, отредактировать), это ограничение Discord API,
// не то, что можно "исправить" кодом. managed-роли (интеграции/другие
// боты) и @everyone не считаются — их позиция обычно не в руках
// администратора этого бота.
function findRolesAboveOrAtBot(roles, botPosition) {
    return roles.filter(r => !r.everyone && !r.managed && r.position >= botPosition);
}

// Опасные права, которые сейчас реально стоят у @everyone — то, что
// можно безопасно снять автоматически: не бывает легитимной причины
// давать Administrator/BanMembers/и т.п. вообще всем на сервере.
function findDangerousEveryonePermissions(everyoneRole) {
    return DANGEROUS_FOR_EVERYONE.filter(name => everyoneRole.permissions.includes(name));
}

// canonicalOrderIds — роли, которые провижинит сам бот (scripts/setup-
// roles.js), сверху вниз; только их позиции безопасно переставлять
// автоматически — это ровно то же самое действие, что setup-roles.js уже
// делает при каждом деплое (см. guild.roles.setPositions там), просто
// доступное отдельным скриптом без полного передеплоя. Роли, которые
// администратор завёл сам (например "Администратор") или которые
// провижинят другие скрипты, сюда не входят — их переставлять без
// явного запроса рискованно (см. договорённость по переделке ролей).
function computeManagedRoleDrift(canonicalOrderIds, currentPositionsById, botPosition) {
    const drift = [];
    canonicalOrderIds.forEach((roleId, i) => {
        if (!roleId || !(roleId in currentPositionsById)) return;
        const desired = botPosition - 1 - i;
        if (desired < 1) return;
        if (currentPositionsById[roleId] !== desired) {
            drift.push({ roleId, position: desired });
        }
    });
    return drift;
}

module.exports = {
    DANGEROUS_FOR_EVERYONE,
    findDuplicateRoleNames,
    findRolesAboveOrAtBot,
    findDangerousEveryonePermissions,
    computeManagedRoleDrift,
};
