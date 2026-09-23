require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const security = require('../security');
const moderation = require('../moderation');
const { isBootstrap, ensureRole } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Роль "Администратор" на сервере уже есть — её завёл сам администратор,
// не бот. Раньше здесь был findOrCreateRole({name: 'Admin', ...}) — по
// английскому имени он ни разу не находил "Администратор" и на каждом
// первом запуске заводил рядом бессмысленный дубль с тем же правом
// Administrator (сейчас уже стоит на сервере — см. baseRoleIds.Admin,
// удалить вручную в Настройках сервера → Роли, скрипт сам роли не
// удаляет). Вместо создания второй admin-роли просто пиним ID уже
// существующей — остальной код (isStaff() и т.п.) всё равно проверяет
// PermissionFlagsBits.Administrator, а не конкретный ID роли, так что
// какая именно роль выдаёт это право, ему не важно.
const ADMIN_ROLE_ID = '1549130312238501888';

const ROLES = [
    {
        name: 'Moderator',
        color: 0x3498db,
        hoist: true,
        mentionable: false,
        permissions: [
            PermissionsBitField.Flags.KickMembers,
            PermissionsBitField.Flags.BanMembers,
            PermissionsBitField.Flags.ModerateMembers,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.ManageNicknames,
            PermissionsBitField.Flags.ViewAuditLog,
        ],
    },
    // Испытательный срок перед полным Moderator — те же повседневные
    // права (мут/варн/чистка сообщений), но без Kick/Ban: необратимые
    // решения стажёр сам не принимает.
    {
        name: 'Beta-Moderator',
        color: 0x85c1e9,
        hoist: true,
        mentionable: false,
        permissions: [
            PermissionsBitField.Flags.ModerateMembers,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.ManageNicknames,
            PermissionsBitField.Flags.ViewAuditLog,
        ],
    },
    {
        name: 'Trusted',
        color: 0xf1c40f,
        hoist: true,
        mentionable: false,
        permissions: [],
    },
    // Кастомный мут (moderation/model.js) вместо нативного Discord-
    // таймаута — сама по себе роль без прав ничего не блокирует, реальный
    // запрет писать/реагировать/подключаться к голосу выставляется ниже,
    // отдельными per-категорийными оверрайтами (иначе нельзя: Discord-
    // права ролей только выдают, отнять что-то у уже разрешённого может
    // только явный оверрайт канала/категории).
    {
        name: 'Muted',
        color: 0x7f8c8d,
        hoist: false,
        mentionable: false,
        permissions: [],
    },
];

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();

        const me = await guild.members.fetchMe();
        const botPosition = me.roles.highest.position;

        if (isBootstrap() && botPosition <= 1) {
            console.error(
                'Роль бота слишком низко в иерархии — новые роли могут оказаться выше неё, и бот не сможет ими управлять. Подними роль бота вручную (Настройки сервера → Роли) и перезапусти скрипт.'
            );
            process.exit(1);
        }

        const securityConfig = await security.getConfig();
        const baseRoleIds = { ...securityConfig.baseRoleIds };

        const adminRole = guild.roles.cache.get(ADMIN_ROLE_ID);
        if (adminRole) {
            baseRoleIds.Admin = adminRole.id;
            console.log(`Роль "Admin" указывает на существующую роль: ${adminRole.name} (${adminRole.id})`);
        } else {
            console.error(
                `Роль с ID ${ADMIN_ROLE_ID} (ожидалась "Администратор") не найдена на сервере — проверь ADMIN_ROLE_ID в scripts/setup-roles.js.`
            );
        }

        const found = {};
        const createdNow = [];
        for (const r of ROLES) {
            const { role, created } = await ensureRole({
                guild,
                existingId: baseRoleIds[r.name],
                name: r.name,
                color: r.color,
                hoist: r.hoist,
                mentionable: r.mentionable,
                permissions: r.permissions,
            });
            if (!role) continue;
            console.log(created ? `Создана роль: ${r.name}` : `Роль уже настроена: ${role.name}`);
            baseRoleIds[r.name] = role.id;
            found[r.name] = role;
            if (created) createdNow.push(r);
        }

        // Позиция — только у ролей, созданных прямо сейчас (--bootstrap).
        // Раньше каждый деплой ставил все четыре роли сразу под роль бота и
        // тем самым откатывал иерархию, выставленную вручную или
        // scripts/reorganize-custom-roles.js (Trusted/Muted внизу).
        const positions = createdNow
            .map(r => ({ role: found[r.name].id, position: botPosition - 1 - ROLES.indexOf(r) }))
            .filter(p => p.position >= 1);
        if (positions.length) {
            // Discord отказывает (Missing Permissions) всей пачке, если хотя бы
            // одна из ролей уже стоит выше роли бота — это не мешает остальной
            // настройке, поэтому не даём ошибке прервать скрипт.
            try {
                await guild.roles.setPositions(positions);
                console.log('Позиции новых ролей выставлены ниже роли бота.');
            } catch (err) {
                console.error(
                    'Не удалось выставить позиции ролей (вероятно, конфликт иерархии — поправь позиции вручную в Настройках сервера → Роли):',
                    err.message
                );
            }
        }

        await security.updateConfig(config => {
            if (found.Trusted) config.trustedRoleId = found.Trusted.id;
            config.baseRoleIds = baseRoleIds;
        });
        if (found.Trusted) console.log(`Роль Trusted (${found.Trusted.id}) в белом списке anti-nuke.`);

        // Deny-оверрайт роли Muted на КАЖДЫЙ канал и категорию (канальный
        // оверрайт другой роли иначе может перебить категорийный запрет).
        // Только при --bootstrap: каналы, созданные позже, подхватывает
        // moderation/index.js (событие channelCreate), а проход по всем
        // каналам на каждом деплое переписывал бы права, выставленные
        // администратором вручную. isThread() — guild.channels.cache
        // включает и треды, на которых оверрайт невозможен.
        if (isBootstrap() && found.Muted) {
            await guild.channels.fetch();
            const muteTargets = guild.channels.cache.filter(c => !c.isThread());
            for (const channel of muteTargets.values()) {
                await moderation.applyMuteOverwrite(channel, found.Muted.id);
            }
            console.log(`Роль Muted настроена на ${muteTargets.size} каналах/категориях.`);
        }

        console.log('Готово.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка при создании ролей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
