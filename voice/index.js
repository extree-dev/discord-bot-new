const handlers = require('./handlers');
const model = require('./model');

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
};
