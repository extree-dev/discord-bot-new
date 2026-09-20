require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

// Разовый диагностический отчёт (запускать вручную, не входит в деплой):
// `docker compose run --rm bot node scripts/audit-roles.js`
//
// Только читает и печатает — НИЧЕГО на сервере не меняет. Администратор
// попросил "пройтись по всем ролям, проверить права и расставить в
// правильном порядке" после того, как из-за старого бага в /backup restore
// на сервере задвоилась роль администратора (пофикшено в 3.9.4). Менять
// позиции ролей на живом сервере вслепую рискованно — от этого зависит
// каскад прав модерации (кто может банить/мутить/трогать роли ниже себя),
// поэтому сначала просто печатаем текущее состояние и считаем предложенный
// порядок, ничего не применяя. Следующий шаг (сам apply) — отдельный скрипт
// после того, как администратор посмотрит на этот отчёт и подтвердит логику
// сортировки или задаст свою.

// Права, которые реально решают, что роль может сделать с сервером/людьми —
// остальные (Send Messages, Connect и т.д.) на "опасность"/иерархию не влияют.
// Вес — грубая прикидка "насколько это опасно доверить not-полностью
// проверенному человеку", просто чтобы отсортировать роли сверху вниз, а не
// точная модель прав Discord.
const POWER_WEIGHTS = [
    [PermissionsBitField.Flags.Administrator, 1000],
    [PermissionsBitField.Flags.ManageGuild, 120],
    [PermissionsBitField.Flags.ManageRoles, 110],
    [PermissionsBitField.Flags.ManageWebhooks, 60],
    [PermissionsBitField.Flags.BanMembers, 90],
    [PermissionsBitField.Flags.KickMembers, 80],
    [PermissionsBitField.Flags.ManageChannels, 70],
    [PermissionsBitField.Flags.ModerateMembers, 55],
    [PermissionsBitField.Flags.ManageMessages, 40],
    [PermissionsBitField.Flags.MuteMembers, 30],
    [PermissionsBitField.Flags.DeafenMembers, 25],
    [PermissionsBitField.Flags.MoveMembers, 20],
    [PermissionsBitField.Flags.ManageNicknames, 20],
    [PermissionsBitField.Flags.ManageThreads, 15],
    [PermissionsBitField.Flags.ManageEvents, 10],
    [PermissionsBitField.Flags.ManageEmojisAndStickers, 10],
    [PermissionsBitField.Flags.MentionEveryone, 8],
    [PermissionsBitField.Flags.ViewAuditLog, 5],
];

// Права, которые совсем не должны стоять у @everyone (риск для любого
// зашедшего на сервер, а не только "неудобно в иерархии").
const DANGEROUS_FOR_EVERYONE = [
    PermissionsBitField.Flags.Administrator,
    PermissionsBitField.Flags.ManageGuild,
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.BanMembers,
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.ModerateMembers,
    PermissionsBitField.Flags.ManageWebhooks,
    PermissionsBitField.Flags.MentionEveryone,
];

function powerScore(permissions) {
    return POWER_WEIGHTS.reduce((sum, [flag, weight]) => sum + (permissions.has(flag) ? weight : 0), 0);
}

function keyPermissionNames(permissions) {
    return POWER_WEIGHTS.filter(([flag]) => permissions.has(flag))
        .map(([flag]) => Object.entries(PermissionsBitField.Flags).find(([, v]) => v === flag)?.[0])
        .filter(Boolean);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.members.fetch();

        // position выше = роль главнее (стоит выше в списке ролей на сервере).
        const roles = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);

        console.log(`\n=== Аудит ролей: ${guild.name} (${roles.length} ролей) ===\n`);
        console.log('Текущий порядок (сверху вниз = главнее → менее главная):\n');

        for (const role of roles) {
            const perms = keyPermissionNames(role.permissions);
            const flags = [];
            if (role.managed) flags.push('managed (бот/интеграция)');
            if (role.tags?.botId) flags.push(`роль бота ${role.tags.botId}`);
            const suffix = flags.length ? ` [${flags.join(', ')}]` : '';
            console.log(
                `  #${String(role.position).padStart(3)}  ${role.name} (${role.id})${suffix}\n` +
                    `        участников: ${role.members.size}, power-score: ${powerScore(role.permissions)}` +
                    (perms.length ? `, права: ${perms.join(', ')}` : ', опасных прав нет')
            );
        }

        // --- Проверки ---
        console.log('\n=== Находки ===\n');
        let issues = 0;

        const byNameLower = new Map();
        for (const role of roles) {
            const key = role.name.trim().toLowerCase();
            if (!byNameLower.has(key)) byNameLower.set(key, []);
            byNameLower.get(key).push(role);
        }
        for (const [name, group] of byNameLower) {
            if (group.length > 1) {
                issues++;
                console.log(
                    `  ⚠ Похоже, роль задвоена: "${name}" встречается ${group.length} раз(а) — ` +
                        group.map(r => `${r.id} (участников: ${r.members.size})`).join(', ')
                );
            }
        }

        const everyone = guild.roles.everyone;
        const everyoneDangerous = DANGEROUS_FOR_EVERYONE.filter(flag => everyone.permissions.has(flag));
        if (everyoneDangerous.length) {
            issues++;
            const names = everyoneDangerous
                .map(flag => Object.entries(PermissionsBitField.Flags).find(([, v]) => v === flag)?.[0])
                .filter(Boolean);
            console.log(`  ⚠ У @everyone есть опасные права: ${names.join(', ')} — снять всем сразу коснётся.`);
        }

        const adminRoles = roles.filter(r => r.permissions.has(PermissionsBitField.Flags.Administrator) && !r.managed);
        if (adminRoles.length > 2) {
            issues++;
            console.log(
                `  ⚠ Ролей с правом Administrator (не считая интеграций) многовато — ${adminRoles.length}: ` +
                    adminRoles.map(r => r.name).join(', ') +
                    '. Обычно достаточно одной-двух — остальным лучше выдавать точечные права.'
            );
        }

        // Отдельная (более прицельная, чем просто "многовато admin-ролей")
        // проверка: Administrator-роль без единого участника — почти всегда
        // забытый дубликат (например, ровно так на сервере повторно появлялась
        // "Admin" из-за бага в /backup restore, см. 3.9.4), даже если Administrator-
        // ролей всего две и порог adminRoles.length > 2 выше не сработал.
        const emptyAdminRoles = adminRoles.filter(r => r.members.size === 0);
        if (emptyAdminRoles.length) {
            issues++;
            console.log(
                `  ⚠ Есть роль(и) с правом Administrator, в которых нет ни одного участника — похоже на неиспользуемый дубликат: ` +
                    emptyAdminRoles.map(r => `${r.name} (${r.id})`).join(', ') +
                    '. Если это действительно дубль, а не заготовка для будущей роли — удалите вручную.'
            );
        }

        const me = await guild.members.fetchMe();
        const botPosition = me.roles.highest.position;
        const aboveBot = roles.filter(r => r.position >= botPosition && r.id !== guild.roles.everyone.id && !r.managed);
        if (aboveBot.length) {
            issues++;
            console.log(
                `  ⚠ Роли выше (или на уровне) роли бота — бот не может ими управлять/переставлять их: ` +
                    aboveBot.map(r => r.name).join(', ') +
                    '. Если это не намеренно (например, отдельная "супер-админ" роль владельца), подними роль бота выше вручную.'
            );
        }

        // Предложенный порядок — не считая @everyone (Discord всегда держит её
        // внизу) и managed-ролей ботов/интеграций (их позицию обычно лучше не
        // трогать — она может быть завязана на саму интеграцию).
        const sortable = roles.filter(r => r.id !== everyone.id && !r.managed);
        const suggested = [...sortable].sort((a, b) => powerScore(b.permissions) - powerScore(a.permissions));

        let orderDiffers = false;
        for (let i = 0; i < suggested.length; i++) {
            if (suggested[i].id !== sortable[i].id) {
                orderDiffers = true;
                break;
            }
        }

        console.log('\n=== Предложенный порядок (по убыванию power-score, без @everyone и managed-ролей) ===\n');
        if (!orderDiffers) {
            console.log('  Текущий порядок уже совпадает с предложенным — менять не нужно.');
        } else {
            suggested.forEach((role, i) => {
                const currentIndex = sortable.findIndex(r => r.id === role.id);
                const moved =
                    currentIndex !== i
                        ? ` (сейчас позиция ${role.position}, предложено ${i < currentIndex ? 'поднять' : 'опустить'})`
                        : '';
                console.log(`  ${i + 1}. ${role.name} — power-score: ${powerScore(role.permissions)}${moved}`);
            });
            console.log(
                '\n  Это ТОЛЬКО предложение по опасности прав — ролям с одинаковым power-score (например, ' +
                    'нескольким ролям уровней репутации без модераторских прав) порядок между собой может быть не важен, ' +
                    'а какие-то роли (например, цветовые/косметические) стоит расположить по смыслу, а не по этой формуле. ' +
                    'Ничего не применено — это только отчёт.'
            );
        }

        if (!issues) console.log('  Явных проблем не нашлось.');

        console.log('\nГотово. Отчёт ничего не менял на сервере.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка при аудите ролей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
