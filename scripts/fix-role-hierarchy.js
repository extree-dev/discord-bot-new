require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const security = require('../security');
const {
    findDuplicateRoleNames,
    findRolesAboveOrAtBot,
    findDangerousEveryonePermissions,
    computeManagedRoleDrift,
} = require('../utils/roleHierarchy');

// Запускать вручную: `docker compose run --rm bot node scripts/fix-role-hierarchy.js`
// (не входит в деплой — в отличие от setup-roles.js, это не провижининг
// новых ролей, а разовая проверка+починка уже существующей иерархии, по
// прямому запросу администратора).
//
// В отличие от read-only scripts/audit-roles.js (тот же список находок,
// но только печатает отчёт), этот скрипт ДЕЙСТВИТЕЛЬНО чинит то, что
// можно починить безопасно и однозначно:
//   1. Снимает опасные права (Administrator, BanMembers и т.п.) с
//      @everyone — так быть не должно никогда, случай без вариантов.
//   2. Возвращает роли, которые провижинит сам бот (Moderator/Beta-
//      Moderator/Trusted/Muted — тот же список, что и в
//      scripts/setup-roles.js), на их канонические позиции под ролью
//      бота, если их кто-то вручную подвинул. Это то же самое действие,
//      что setup-roles.js уже выполняет на каждом деплое — просто
//      доступное отдельным запуском, без полного передеплоя.
// Остальные находки (задвоенные роли по имени, роли выше или на уровне
// роли бота) — ТОЛЬКО отчёт: удалить не тот дубликат или передвинуть не
// туда роль, от которой зависит каскад прав модерации, на живом сервере
// необратимо рискованнее, чем оставить администратору решить руками.

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.members.fetch();

        const me = await guild.members.fetchMe();
        const botPosition = me.roles.highest.position;

        const roles = [...guild.roles.cache.values()].map(r => ({
            id: r.id,
            name: r.name,
            position: r.position,
            permissions: r.permissions.toArray(),
            managed: r.managed,
            everyone: r.id === guild.roles.everyone.id,
            memberCount: r.members.size,
        }));

        console.log(`\n=== Проверка иерархии ролей: ${guild.name} ===\n`);
        let fixed = 0;
        let needsManualAttention = 0;

        // --- 1. Опасные права у @everyone — снимаем ---
        const everyone = guild.roles.everyone;
        const everyoneRole = roles.find(r => r.everyone);
        const dangerous = findDangerousEveryonePermissions(everyoneRole);
        if (dangerous.length) {
            // permissions.remove() мутирует локальный PermissionsBitField
            // и возвращает его же — саму роль на Discord это не меняет,
            // нужен отдельный setPermissions() (та же пара вызовов, что
            // security/antiNuke.js использует для отката прав роли).
            const newPermissions = everyone.permissions.remove(dangerous);
            await everyone
                .setPermissions(newPermissions, 'fix-role-hierarchy: сняты опасные права с @everyone')
                .then(() => {
                    console.log(`✔ Сняты опасные права с @everyone: ${dangerous.join(', ')}`);
                    fixed++;
                })
                .catch(err => {
                    console.error(`✘ Не удалось снять права с @everyone (${dangerous.join(', ')}):`, err.message);
                });
        } else {
            console.log('✔ У @everyone нет опасных прав — без изменений.');
        }

        // --- 2. Позиции ролей, которые провижинит бот ---
        const securityConfig = await security.getConfig();
        const baseRoleIds = securityConfig.baseRoleIds ?? {};
        // Тот же порядок и тот же набор ролей, что ROLES в
        // scripts/setup-roles.js (без Admin — это не роль бота, см. фикс
        // дублирования Admin/Администратор).
        const canonicalOrderIds = [
            baseRoleIds.Moderator,
            baseRoleIds['Beta-Moderator'],
            baseRoleIds.Trusted,
            baseRoleIds.Muted,
        ];
        const currentPositionsById = Object.fromEntries(roles.map(r => [r.id, r.position]));
        const drift = computeManagedRoleDrift(canonicalOrderIds, currentPositionsById, botPosition);
        if (drift.length) {
            try {
                await guild.roles.setPositions(drift.map(d => ({ role: d.roleId, position: d.position })));
                console.log(
                    `✔ Возвращены на место роли: ${drift.map(d => roles.find(r => r.id === d.roleId)?.name ?? d.roleId).join(', ')}`
                );
                fixed++;
            } catch (err) {
                console.error('✘ Не удалось переставить роли (конфликт иерархии?):', err.message);
                needsManualAttention++;
            }
        } else {
            console.log('✔ Роли бота (Moderator/Beta-Moderator/Trusted/Muted) уже на своих местах.');
        }

        // --- 3. Только отчёт: задвоенные роли ---
        const duplicates = findDuplicateRoleNames(roles);
        if (duplicates.length) {
            needsManualAttention++;
            console.log('\n⚠ Задвоенные роли (реши вручную, какую оставить, в Настройках сервера → Роли):');
            for (const group of duplicates) {
                console.log(
                    `  "${group[0].name}" — ${group.length} шт: ` +
                        group.map(r => `${r.id} (участников: ${r.memberCount})`).join(', ')
                );
            }
        }

        // --- 4. Только отчёт: роли выше или на уровне роли бота ---
        const aboveBot = findRolesAboveOrAtBot(roles, botPosition);
        if (aboveBot.length) {
            needsManualAttention++;
            console.log(
                '\n⚠ Роли на уровне роли бота или выше — бот не может ими управлять, подними роль бота вручную, ' +
                    'если это не намеренно (например, отдельная роль владельца):'
            );
            for (const r of aboveBot) console.log(`  ${r.name} (${r.id})`);
        }

        console.log(
            `\nГотово. Исправлено автоматически: ${fixed}. Требует ручного внимания: ${needsManualAttention}` +
                (needsManualAttention ? ' (см. ⚠ выше).' : '.')
        );
        process.exit(0);
    } catch (err) {
        console.error('Ошибка при проверке иерархии ролей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
