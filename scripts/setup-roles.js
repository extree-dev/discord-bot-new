require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const security = require('../security');
const { findOrCreateRole } = require('./lib/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const ROLES = [
    {
        name: 'Admin',
        color: 0xe74c3c,
        hoist: true,
        mentionable: false,
        permissions: [PermissionsBitField.Flags.Administrator],
    },
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
    {
        name: 'Trusted',
        color: 0xf1c40f,
        hoist: true,
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

        if (botPosition <= 1) {
            console.error(
                'Роль бота слишком низко в иерархии — новые роли могут оказаться выше неё, и бот не сможет ими управлять. Подними роль бота вручную (Настройки сервера → Роли) и перезапусти скрипт.'
            );
            process.exit(1);
        }

        const securityConfig = await security.getConfig();
        const baseRoleIds = { ...securityConfig.baseRoleIds };
        const created = {};
        for (const r of ROLES) {
            const { role, created: wasCreated } = await findOrCreateRole({
                guild,
                existingId: baseRoleIds[r.name],
                name: r.name,
                color: r.color,
                hoist: r.hoist,
                mentionable: r.mentionable,
                permissions: r.permissions,
            });
            console.log(wasCreated ? `Создана роль: ${r.name}` : `Роль уже настроена: ${role.name}`);
            baseRoleIds[r.name] = role.id;
            created[r.name] = role;
        }

        const positions = ROLES.map((r, i) => ({ role: created[r.name].id, position: botPosition - 1 - i })).filter(
            p => p.position >= 1
        );
        if (positions.length) {
            // Discord отказывает (Missing Permissions) всей пачке, если хотя бы
            // одна из этих ролей уже стоит выше роли бота в иерархии (например,
            // её вручную подвинул администратор) — это не мешает остальной
            // настройке (сами роли уже созданы/найдены выше), поэтому не даём
            // этой ошибке прервать скрипт.
            try {
                await guild.roles.setPositions(positions);
                console.log('Позиции ролей выставлены ниже роли бота.');
            } catch (err) {
                console.error(
                    'Не удалось выставить позиции ролей (вероятно, конфликт иерархии — поправь позиции вручную в Настройках сервера → Роли):',
                    err.message
                );
            }
        }

        await security.updateConfig(config => {
            config.trustedRoleId = created['Trusted'].id;
            config.baseRoleIds = baseRoleIds;
        });
        console.log(`Роль Trusted (${created['Trusted'].id}) добавлена в белый список anti-nuke.`);

        console.log('Готово.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка при создании ролей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
