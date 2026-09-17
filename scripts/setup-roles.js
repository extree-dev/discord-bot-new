require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const security = require('../security');

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
    {
        name: 'Participant',
        color: 0x99aab5,
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

        if (botPosition <= 1) {
            console.error(
                'Роль бота слишком низко в иерархии — новые роли могут оказаться выше неё, и бот не сможет ими управлять. Подними роль бота вручную (Настройки сервера → Роли) и перезапусти скрипт.'
            );
            process.exit(1);
        }

        const created = {};
        for (const r of ROLES) {
            let role = guild.roles.cache.find(x => x.name === r.name);
            if (role) {
                console.log(`Роль уже существует: ${r.name}`);
            } else {
                role = await guild.roles.create({
                    name: r.name,
                    color: r.color,
                    hoist: r.hoist,
                    mentionable: r.mentionable,
                    permissions: r.permissions,
                });
                console.log(`Создана роль: ${r.name}`);
            }
            created[r.name] = role;
        }

        const positions = ROLES.map((r, i) => ({ role: created[r.name].id, position: botPosition - 1 - i })).filter(
            p => p.position >= 1
        );
        if (positions.length) {
            await guild.roles.setPositions(positions);
            console.log('Позиции ролей выставлены ниже роли бота.');
        }

        await security.updateConfig(config => {
            config.trustedRoleId = created['Trusted'].id;
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
