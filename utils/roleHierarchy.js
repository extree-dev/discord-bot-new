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

// Для scripts/reorganize-custom-roles.js — разовая перестройка блока
// кастомных/ярусных ролей прямо под anchorId (например, Moderator) и
// блока bottomOrderIds в самый низ (например, Trusted/Muted), без
// изменения относительного порядка всего остального между ними (ролей,
// которые администратор не просил трогать). managedOrderIds/
// bottomOrderIds — желаемый порядок сверху вниз; роли, которых нет среди
// присланных roles (удалены вручную), пропускаются, а не создаются —
// это не задача этой функции. Возвращает только записи, чья позиция
// реально должна измениться (как computeManagedRoleDrift выше) — вызов
// с уже верной раскладкой не даёт лишних API-запросов.
function computeReorganizedPositions({ roles, anchorId, managedOrderIds, bottomOrderIds, everyoneId }) {
    const byId = new Map(roles.map(r => [r.id, r]));
    const anchor = byId.get(anchorId);
    if (!anchor) return null;

    const managedSet = new Set(managedOrderIds);
    const bottomSet = new Set(bottomOrderIds);

    // Всё, что сейчас ниже anchor и не входит ни в управляемый блок, ни в
    // низовые роли, ни в managed-интеграции/@everyone — остаётся в своём
    // текущем относительном порядке, просто уступает место сверху.
    const untouchedIds = roles
        .filter(
            r =>
                !r.managed &&
                r.id !== everyoneId &&
                r.id !== anchorId &&
                r.position < anchor.position &&
                !managedSet.has(r.id) &&
                !bottomSet.has(r.id)
        )
        .sort((a, b) => b.position - a.position)
        .map(r => r.id);

    const orderedIds = [
        ...managedOrderIds.filter(id => byId.has(id)),
        ...untouchedIds,
        ...bottomOrderIds.filter(id => byId.has(id)),
    ];

    const updates = [];
    let position = anchor.position - 1;
    for (const id of orderedIds) {
        if (position < 1) break;
        if (byId.get(id).position !== position) updates.push({ roleId: id, position });
        position--;
    }
    return updates;
}

module.exports = {
    DANGEROUS_FOR_EVERYONE,
    findDuplicateRoleNames,
    findRolesAboveOrAtBot,
    findDangerousEveryonePermissions,
    computeManagedRoleDrift,
    computeReorganizedPositions,
};
