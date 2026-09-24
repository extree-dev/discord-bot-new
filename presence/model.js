// Статус бота (rich presence) и ротация по таймеру между несколькими
// вариантами. Применяется при старте (index.js) и командой /status;
// крутится по тому же принципу, что и tickets/sweep.js — фиксированный
// тик проверяет истекшее время против настраиваемого интервала, а не
// пересоздаёт setInterval на каждое изменение конфига.
const { ActivityType } = require('discord.js');
const { load, update } = require('./config');

const ACTIVITY_TYPES = {
    playing: ActivityType.Playing,
    streaming: ActivityType.Streaming,
    watching: ActivityType.Watching,
    listening: ActivityType.Listening,
    competing: ActivityType.Competing,
};

const ACTIVITY_LABELS = {
    [ActivityType.Playing]: 'Играет в',
    [ActivityType.Streaming]: 'Стримит',
    [ActivityType.Watching]: 'Смотрит',
    [ActivityType.Listening]: 'Слушает',
    [ActivityType.Competing]: 'Участвует в',
};

// Discord рисует бейдж "В эфире" (фиолетовый) только при типе Streaming
// с ссылкой на twitch.tv/<канал> или youtube.com/watch?v=... — с любым
// другим url или без него статус просто показывается как обычный,
// без бейджа.
const STREAM_URL_REGEX = /^https?:\/\/(www\.)?(twitch\.tv\/\w+|youtube\.com\/watch\?v=|youtu\.be\/)/i;

function isValidStreamUrl(url) {
    return typeof url === 'string' && STREAM_URL_REGEX.test(url);
}

const TICK_MS = 30 * 1000;

// "2д 5ч 12м" — сколько бот работает без перезапуска. Чистая функция,
// не трогает Discord API — покрыта тестом отдельно от resolveTemplate.
function formatUptime(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days}д`);
    if (hours) parts.push(`${hours}ч`);
    parts.push(`${minutes}м`);
    return parts.join(' ');
}

// {members} — число участников основного сервера (GUILD_ID из .env,
// либо первая гильдия в кэше, если не задан), {uptime} — см. formatUptime.
function resolveTemplate(text, client) {
    if (!text) return text;
    const guild = process.env.GUILD_ID ? client.guilds.cache.get(process.env.GUILD_ID) : client.guilds.cache.first();
    return text
        .replace(/\{members\}/g, guild ? String(guild.memberCount) : '?')
        .replace(/\{uptime\}/g, formatUptime(process.uptime() * 1000));
}

async function applyActivity(client, config, item) {
    const activity = item?.text
        ? {
              name: resolveTemplate(item.text, client),
              type: item.type,
              ...(item.type === ActivityType.Streaming && isValidStreamUrl(item.url) ? { url: item.url } : {}),
          }
        : null;
    await client.user.setPresence({
        status: config.status,
        activities: activity ? [activity] : [],
    });
}

// Вызывается при старте бота и сразу после любого изменения через
// /status — применяет то, что сейчас актуально (текущий пункт ротации
// или фиксированный статус), не дожидаясь следующего тика.
async function applyCurrentPresence(client) {
    const config = await load();
    if (config.rotate && config.rotateItems.length) {
        const index = config.rotateIndex % config.rotateItems.length;
        await applyActivity(client, config, config.rotateItems[index]);
    } else {
        await applyActivity(client, config, config.activity);
    }
}

async function tick(client) {
    const config = await load();
    if (!config.rotate || config.rotateItems.length < 2) return;
    if (Date.now() - config.lastRotatedAt < config.rotateIntervalMs) return;

    const nextIndex = (config.rotateIndex + 1) % config.rotateItems.length;
    await update(cfg => {
        cfg.rotateIndex = nextIndex;
        cfg.lastRotatedAt = Date.now();
    });
    await applyActivity(client, config, config.rotateItems[nextIndex]);
}

function start(client) {
    applyCurrentPresence(client).catch(err => console.error('presence:', err));
    setInterval(() => {
        tick(client).catch(err => console.error('presence tick:', err));
    }, TICK_MS);
}

module.exports = {
    ACTIVITY_TYPES,
    ACTIVITY_LABELS,
    isValidStreamUrl,
    formatUptime,
    start,
    applyCurrentPresence,
};
