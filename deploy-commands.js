require('dotenv').config({ quiet: true });
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./utils/loadCommands');

const commands = loadCommands().map(command => command.data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Регистрация ${commands.length} slash-команд...`);

        // Регистрация ОДНОВРЕМЕННО и глобально, и на конкретном сервере
        // (GUILD_ID) создаёт две отдельные копии одной и той же команды —
        // Discord не считает их дубликатом одной команды, обе видны в
        // списке одновременно. Раз бот работает на одном сервере, гильдийная
        // регистрация — не просто "быстрее видно при разработке" (см.
        // старый комментарий в README), а единственная нужная: применяется
        // сразу, а не до часа, как глобальная. Поэтому при заданном
        // GUILD_ID регистрируем только на сервере и явно очищаем глобальные
        // команды (пустым телом), чтобы убрать уже накопившиеся дубликаты
        // от предыдущих деплоев.
        if (process.env.GUILD_ID) {
            const guildRoute = Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID);
            await rest.put(guildRoute, { body: commands });
            console.log(`На сервере зарегистрировано: ${commands.length}`);

            const globalRoute = Routes.applicationCommands(process.env.CLIENT_ID);
            await rest.put(globalRoute, { body: [] });
            console.log('Глобальные команды очищены (используется только гильдийная регистрация).');
        } else {
            const globalRoute = Routes.applicationCommands(process.env.CLIENT_ID);
            await rest.put(globalRoute, { body: commands });
            console.log(`Глобально зарегистрировано: ${commands.length}`);
        }
    } catch (error) {
        console.error(error);
    }
})();
