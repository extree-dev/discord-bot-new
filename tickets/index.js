const handlers = require('./handlers');
const model = require('./model');

function register(client) {
    handlers.register(client);
    console.log('Система тикетов активирована.');
}

module.exports = {
    register,
    handleButton: handlers.handleButton,
    handleSelectMenu: handlers.handleSelectMenu,
    buildPanelMessage: model.buildPanelMessage,
};
