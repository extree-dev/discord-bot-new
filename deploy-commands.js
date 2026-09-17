require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands', 'moderation');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    commands.push(command.data.toJSON());
}

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
