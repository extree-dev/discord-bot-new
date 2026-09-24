const config = require('./config');
const model = require('./model');
const handlers = require('./handlers');

// Публичный API фичи rolePanel/. scripts/setup-role-panel.js обращается
// только сюда, а не к rolePanel/config.js напрямую.
module.exports = {
    handleSelectMenu: handlers.handleSelectMenu,
    buildPanelMessage: model.buildPanelMessage,
    getConfig: config.load,
    saveTargets: async ({ categoryId, channelId, roleIds }) => {
        await config.update(c => {
            c.categoryId = categoryId;
            c.channelId = channelId;
            c.roleIds = roleIds;
        });
    },
};
