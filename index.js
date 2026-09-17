require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { errorEmbed } = require('./utils/embeds');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands', 'moderation');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

const security = require('./security');
const voice = require('./voice');
const tickets = require('./tickets');

client.once('ready', () => {
    console.log(`Бот запущен как ${client.user.tag}`);
    security.register(client);
    voice.register(client);
    tickets.register(client);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (
            await security
                .handleVerifyButton(interaction)
                .catch(err => (console.error('Ошибка кнопки верификации:', err), false))
        )
            return;
        if (
            await voice
                .handleButton(interaction)
                .catch(err => (console.error('Ошибка кнопки временной комнаты:', err), false))
        )
            return;
        if (await tickets.handleButton(interaction).catch(err => (console.error('Ошибка кнопки тикета:', err), false)))
            return;
    }

    if (interaction.isModalSubmit()) {
        if (
            await security
                .handleVerifyModal(interaction)
                .catch(err => (console.error('Ошибка формы верификации:', err), false))
        )
            return;
        if (
            await voice
                .handleModalSubmit(interaction)
                .catch(err => (console.error('Ошибка формы временной комнаты:', err), false))
        )
            return;
    }

    if (interaction.isUserSelectMenu() || interaction.isStringSelectMenu()) {
        if (
            await voice
                .handleSelectMenu(interaction)
                .catch(err => (console.error('Ошибка select-меню временной комнаты:', err), false))
        )
            return;
        if (
            await tickets
                .handleSelectMenu(interaction)
                .catch(err => (console.error('Ошибка select-меню тикета:', err), false))
        )
            return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const errorReply = { embeds: [errorEmbed('Произошла ошибка при выполнении команды.')], ephemeral: true };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorReply);
            } else {
                await interaction.reply(errorReply);
            }
        } catch (replyError) {
            console.error('Не удалось отправить сообщение об ошибке (интеракция протухла):', replyError.message);
        }
    }
});

process.on('unhandledRejection', err => {
    console.error('Unhandled rejection (бот продолжает работать):', err);
});
process.on('uncaughtException', err => {
    console.error('Uncaught exception (бот продолжает работать):', err);
});

client.login(process.env.DISCORD_TOKEN);
