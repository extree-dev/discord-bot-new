const handlers = require('./handlers');
const model = require('./model');
const config = require('./config');

function register(client) {
    handlers.register(client);
    console.log('Система временных голосовых комнат активирована.');
}

module.exports = {
    register,
    handleButton: handlers.handleButton,
    handleModalSubmit: handlers.handleModalSubmit,
    handleSelectMenu: handlers.handleSelectMenu,
    buildPanelMessage: model.buildPanelMessage,
    trackRoom: model.trackRoom,
    untrackRoom: model.untrackRoom,
    getConfig: config.load,
    updateConfig: config.update,
};
