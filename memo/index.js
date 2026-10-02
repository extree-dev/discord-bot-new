const config = require('./config');
const { buildMemoMessage, getAllMemoText } = require('./model');
const rules = require('../rules');
const changelog = require('../changelog');
const leveling = require('../leveling');
const ideaQueue = require('../ideaQueue');
const suggestions = require('../suggestions');
const tickets = require('../tickets');
const voice = require('../voice');

// Памятка ссылается на каналы почти всех остальных фич сразу — вместо
// того чтобы /memo и scripts/setup-memo.js каждый сами тянули конфиг
// семи разных модулей, сборка живёт в одном месте здесь. Любое поле может
// быть null (фича ещё не настроена/не задеплоена --bootstrap) —
// memo/model.js buildCards() сам подставляет текстовое название канала
// вместо упоминания, если ID нет.
async function gatherChannelIds(guildId) {
    const [rulesLoc, changelogCfg, levelCfg, ideaCfg, suggestionsCfg, ticketsCfg, voiceCfg] = await Promise.all([
        rules.getPostedLocation(),
        changelog.getConfig(),
        leveling.getGuildConfig(guildId),
        ideaQueue.getConfig(),
        suggestions.getConfig(),
        tickets.getConfig(),
        voice.getConfig(),
    ]);
    return {
        rulesChannelId: rulesLoc.channelId,
        newsChannelId: changelogCfg.channelId,
        levelChannelId: levelCfg.announceChannelId,
        ticketChannelId: ticketsCfg.panelChannelId,
        ideaButtonChannelId: suggestionsCfg.panelChannelId,
        ideaResultsChannelId: suggestionsCfg.outputChannelId,
        ideaDirectChannelId: ideaCfg.channelId,
        voiceTriggerChannelId: voiceCfg.triggerChannelId,
    };
}

// Публичный API фичи memo/: /memo и scripts/setup-memo.js обращаются
// только сюда, а не к memo/config.js или memo/model.js напрямую.
module.exports = {
    buildMemoMessage,
    getAllMemoText,
    gatherChannelIds,
    getPostedLocation: async () => {
        const cfg = await config.load();
        return { channelId: cfg.channelId, messageId: cfg.messageId, categoryId: cfg.categoryId };
    },
    savePostedLocation: async (channelId, messageId) => {
        await config.update(cfg => {
            cfg.channelId = channelId;
            cfg.messageId = messageId;
        });
    },
    saveCategoryId: async categoryId => {
        await config.update(cfg => {
            cfg.categoryId = categoryId;
        });
    },
};
