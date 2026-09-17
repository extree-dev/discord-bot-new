require('dotenv').config({ quiet: true });
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./utils/loadCommands');

const commands = loadCommands().map(command => command.data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Регистрация ${commands.length} slash-команд...`);

        const globalRoute = Routes.applicationCommands(process.env.CLIENT_ID);
        await rest.put(globalRoute, { body: commands });
        console.log(`Глобально зарегистрировано: ${commands.length}`);

        if (process.env.GUILD_ID) {
            const guildRoute = Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID);
            await rest.put(guildRoute, { body: commands });
            console.log(`На сервере зарегистрировано: ${commands.length}`);
        }
    } catch (error) {
        console.error(error);
    }
})();
