require('dotenv').config({ quiet: true });
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./utils/loadCommands');

const commands = loadCommands().map(command => command.data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Регистрация ${commands.length} slash-команд...`);

        // Только глобальная регистрация. Раньше при заданном GUILD_ID
        // команды регистрировались на конкретном сервере (применяется
        // сразу, а не до часа, как глобальная) — но у гильдийных команд
        // Discord не показывает значок/аватар бота в списке команд, только
        // у глобальных. Раз бот всё равно работает на одном сервере,
        // задержка применения не критична, а значок — заметнее. Если
        // GUILD_ID всё ещё задан (старая схема), явно очищаем гильдийные
        // команды, чтобы не остались дубликаты рядом с глобальными.
        const globalRoute = Routes.applicationCommands(process.env.CLIENT_ID);
        await rest.put(globalRoute, { body: commands });
        console.log(`Глобально зарегистрировано: ${commands.length}`);

        if (process.env.GUILD_ID) {
            const guildRoute = Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID);
            await rest.put(guildRoute, { body: [] });
            console.log('Гильдийные команды очищены (используется только глобальная регистрация).');
        }
    } catch (error) {
        console.error(error);
    }
})();
