require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const STRUCTURE = [
    {
        name: '📋 Информация',
        channels: [
            { name: 'правила', type: ChannelType.GuildText },
            { name: 'объявления', type: ChannelType.GuildText },
            { name: 'роли', type: ChannelType.GuildText },
        ],
    },
    {
        name: '💬 Общение',
        channels: [
            { name: 'общий-чат', type: ChannelType.GuildText },
            { name: 'мемы', type: ChannelType.GuildText },
            { name: 'бот-команды', type: ChannelType.GuildText },
        ],
    },
    {
        name: '🔊 Голосовые',
        channels: [
            { name: 'Лобби 1', type: ChannelType.GuildVoice },
            { name: 'Лобби 2', type: ChannelType.GuildVoice },
            { name: 'Лобби 3', type: ChannelType.GuildVoice },
            { name: 'AFK', type: ChannelType.GuildVoice },
        ],
    },
];

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const me = await guild.members.fetchMe();
        if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            console.error('У бота нет права Manage Channels на этом сервере.');
            process.exit(1);
        }

        for (const group of STRUCTURE) {
            let category = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && c.name === group.name
            );
            if (!category) {
                category = await guild.channels.create({
                    name: group.name,
                    type: ChannelType.GuildCategory,
                });
                console.log(`Создана категория: ${group.name}`);
            } else {
                console.log(`Категория уже существует: ${group.name}`);
            }

            for (const ch of group.channels) {
                const exists = guild.channels.cache.find(
                    c => c.parentId === category.id && c.name === ch.name && c.type === ch.type
                );
                if (exists) {
                    console.log(`  Канал уже существует: ${ch.name}`);
                    continue;
                }
                await guild.channels.create({
                    name: ch.name,
                    type: ch.type,
                    parent: category.id,
                });
                console.log(`  Создан канал: ${ch.name}`);
            }
        }

        console.log('Готово.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка при создании каналов:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
