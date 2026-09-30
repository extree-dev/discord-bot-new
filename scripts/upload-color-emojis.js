require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const { PALETTE } = require('../rolePanel/colors');
const { renderColorEmojiPng } = require('../rolePanel/colorEmojiIcon');

// Разовая заливка кастомных эмодзи под каждый цвет палитры (не входит в
// деплой — как reorganize-custom-roles.js, ручное действие по прямому
// запросу администратора, а не провижининг). scripts/setup-role-panel.js
// сам подставит эти эмодзи в панель вместо юникод-кружков при следующем
// запуске (см. resolveEmoji там) — здесь только заливка на сервер.
// Идемпотентен: эмодзи с уже занятым именем не трогает и не дублирует.
// Запускать вручную: `docker compose run --rm bot node scripts/upload-color-emojis.js`

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.emojis.fetch();

        let uploaded = 0;
        let skipped = 0;
        const failed = [];
        for (const color of PALETTE) {
            if (guild.emojis.cache.some(e => e.name === color.customEmojiName)) {
                skipped++;
                continue;
            }
            try {
                const attachment = renderColorEmojiPng(color.hex);
                await guild.emojis.create({
                    attachment,
                    name: color.customEmojiName,
                    reason: 'Кастомный эмодзи цвета для панели выбора ролей',
                });
                console.log(`✔ Залит эмодзи ":${color.customEmojiName}:" для "${color.name}".`);
                uploaded++;
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
            `\nГотово. Залито: ${uploaded}, уже было: ${skipped}, не удалось: ${failed.length}.` +
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
