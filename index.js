require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { errorEmbed } = require('./utils/embeds');
const { ensureSchema, closePool } = require('./utils/db');
const { loadCommands } = require('./utils/loadCommands');
const { getVersion } = require('./utils/version');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildWebhooks,
    ],
});

client.commands = new Collection();

for (const command of loadCommands()) {
    client.commands.set(command.data.name, command);
}

const security = require('./security');
const voice = require('./voice');
const tickets = require('./tickets');
const suggestions = require('./suggestions');

client.once('ready', () => {
    console.log(`Бот запущен как ${client.user.tag} (v${getVersion()})`);
    security.register(client);
    voice.register(client);
    tickets.register(client);
    suggestions.register(client);
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
        if (
            await suggestions
                .handleButton(interaction)
                .catch(err => (console.error('Ошибка кнопки предложения:', err), false))
        )
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
        if (
            await tickets
                .handleModalSubmit(interaction)
                .catch(err => (console.error('Ошибка формы тикета:', err), false))
        )
            return;
        if (
            await suggestions
                .handleModalSubmit(interaction)
                .catch(err => (console.error('Ошибка формы предложения:', err), false))
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

let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Получен ${signal}, завершаю работу...`);
    try {
        client.destroy();
        console.log('Соединение с Discord закрыто.');
    } catch (err) {
        console.error('Ошибка при остановке клиента:', err);
    }
    try {
        await closePool();
        console.log('Пул соединений с PostgreSQL закрыт.');
    } catch (err) {
        console.error('Ошибка при закрытии пула PostgreSQL:', err);
    } finally {
        process.exit(0);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Проверяем схему БД до логина в Discord — если PostgreSQL недоступен
// (не задан/неверен DATABASE_URL), лучше явно упасть при старте, чем
// молча ловить ошибки внутри случайного обработчика взаимодействия.
// Ошибку логина в Discord (например, неверный DISCORD_TOKEN) ловим
// отдельным catch — иначе она ошибочно подписывалась бы как ошибка
// PostgreSQL, хотя БД в этом случае доступна и ни при чём.
ensureSchema()
    .then(() => {
        client.login(process.env.DISCORD_TOKEN).catch(err => {
            console.error('Не удалось войти в Discord (проверь DISCORD_TOKEN в .env):', err.message);
            process.exit(1);
        });
    })
    .catch(err => {
        console.error('Не удалось подключиться к PostgreSQL (проверь DATABASE_URL в .env):', err.message);
        process.exit(1);
    });
