const config = require('./config');
const { buildRulesEmbed } = require('./model');

// Публичный API фичи rules/: /rules и scripts/setup-rules.js обращаются
// только сюда, а не к rules/config.js напрямую — так же, как остальные
// фичи (tickets/, voice/, suggestions/).
module.exports = {
    buildRulesEmbed,
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
