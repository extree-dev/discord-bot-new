const handlers = require('./handlers');
const model = require('./model');
const config = require('./config');

function register(client) {
    handlers.register(client);
    console.log('Система предложений активирована.');
}

module.exports = {
    register,
    handleButton: handlers.handleButton,
    handleModalSubmit: handlers.handleModalSubmit,
    buildPanelMessage: model.buildPanelMessage,
    getConfig: config.load,
};
