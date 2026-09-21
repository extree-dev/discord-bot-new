const handlers = require('./handlers');
const model = require('./model');
const config = require('./config');

// Публичный API фичи modqueue/. Команда /mod-queue и
// scripts/setup-modqueue.js обращаются только сюда, а не к
// modqueue/model.js или modqueue/config.js напрямую.
module.exports = {
    register: handlers.register,
    handleButton: handlers.handleButton,
    getConfig: config.load,
    updateConfig: config.update,
    isModerated: model.isModerated,
    addModeratedChannel: model.addModeratedChannel,
    removeModeratedChannel: model.removeModeratedChannel,
};
