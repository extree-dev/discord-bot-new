require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const { PALETTE } = require('../rolePanel/colors');
const { renderColorEmojiPng } = require('../rolePanel/colorEmojiIcon');

// Разовая заливка кастомных эмодзи под каждый цвет палитры (не входит в
// деплой — как reorganize-custom-roles.js, ручное действие по прямому
// запросу администратора, а не провижининг). scripts/setup-role-panel.js
// сам подставит эти эмодзи в панель вместо юникод-кружков при следующем
// запуске (см. resolveEmoji там) — здесь только заливка на сервер.
//
// Пересоздаёт: если эмодзи с этим именем уже есть — удаляет и заливает
// заново из текущего rolePanel/colorEmojiIcon.js. Раньше уже занятое имя
// просто пропускалось, но иконку меняли уже после первой заливки (форма
// не понравилась администратору) — со skip-логикой повторный запуск не
// обновил бы уже залитые эмодзи никогда, только новые с нуля. Discord не
// даёт поменять картинку существующего эмодзи (только имя), так что
// синхронизация с кодом — это всегда удалить-и-залить-заново.
// Запускать вручную: `docker compose run --rm bot node scripts/upload-color-emojis.js`

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.emojis.fetch();

        let uploaded = 0;
        let replaced = 0;
        const failed = [];
        for (const color of PALETTE) {
            const existing = guild.emojis.cache.find(e => e.name === color.customEmojiName);
            try {
                if (existing) {
                    await existing.delete('Обновление иконки цвета для панели выбора ролей');
                }
                const attachment = renderColorEmojiPng(color.hex);
                await guild.emojis.create({
                    attachment,
                    name: color.customEmojiName,
                    reason: 'Кастомный эмодзи цвета для панели выбора ролей',
                });
                console.log(
                    `✔ ${existing ? 'Перезалит' : 'Залит'} эмодзи ":${color.customEmojiName}:" для "${color.name}".`
                );
                if (existing) replaced++;
                else uploaded++;
            } catch (err) {
                // Самая частая причина — на сервере кончились слоты под
                // кастомные эмодзи (лимит зависит от уровня буста), а не
                // ошибка в самом коде — печатаем и продолжаем остальные
                // цвета, а не прерываемся на первом же отказе.
                failed.push({ color, err });
                console.error(`✘ Не удалось залить эмодзи для "${color.name}": ${err.message}`);
            }
        }

        console.log(
            `\nГотово. Залито новых: ${uploaded}, обновлено: ${replaced}, не удалось: ${failed.length}.` +
                (failed.length
                    ? ' Проверь, не кончились ли слоты под кастомные эмодзи на сервере (Настройки сервера → Эмодзи).'
                    : '')
        );
        process.exit(failed.length ? 1 : 0);
    } catch (err) {
        console.error('Ошибка заливки эмодзи цветов:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
