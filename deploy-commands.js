require('dotenv').config({ quiet: true });
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./utils/loadCommands');

// REST-only — в отличие от scripts/setup-*.js, не нуждается в
// gateway-логине (client.login()), поэтому оркестратор
// scripts/deploy-sync.js запускает этот шаг, не дожидаясь подключения
// общего клиента.
async function run() {
    // Раньше ошибка здесь только логировалась (console.error) и run()
    // ничего не возвращал — deploy-sync.js (и раньше, отдельный "docker
    // compose run" в deploy.yml) видел "успех" в любом случае, и падение
    // регистрации слэш-команд (например, из-за отсутствующего CLIENT_ID)
    // молча проходило мимо, не помечая деплой красным. Явная проверка
    // ниже даёт понятную причину сразу, а не крипто-ошибку Discord
    // ("application_id... is not snowflake") постфактум в логе.
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
        console.error(
            'DISCORD_TOKEN и/или CLIENT_ID не заданы — регистрация слэш-команд невозможна. Проверь .env на сервере (CLIENT_ID — Application ID из Discord Developer Portal, см. .env.example).'
        );
        return false;
    }

    const commands = loadCommands().map(command => command.data.toJSON());
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
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
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

module.exports = run;

if (require.main === module) {
    run().then(ok => process.exit(ok ? 0 : 1));
}
