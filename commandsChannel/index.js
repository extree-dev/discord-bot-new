const config = require('./config');

// Чистая функция для теста — сама async-обёртка (isAllowedChannel) не
// тестируется напрямую, только через неё. Канал не ограничен, если
// channelId не настроен вообще (null) — это дефолт "доступно везде".
function isAllowed(configuredChannelId, channelId) {
    return !configuredChannelId || configuredChannelId === channelId;
}

async function isAllowedChannel(channelId) {
    const cfg = await config.load();
    return isAllowed(cfg.channelId, channelId);
}

// Публичный API фичи commandsChannel/. index.js (роутинг interactionCreate)
// и commands/moderation/commands-channel.js обращаются только сюда.
module.exports = {
    getConfig: config.load,
    updateConfig: config.update,
    isAllowed,
    isAllowedChannel,
};
