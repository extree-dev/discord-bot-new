const handlers = require('./handlers');
const model = require('./model');
const config = require('./config');

// Публичный API фичи adminPanel/ — только то, что нужно снаружи
// (index.js для роутинга кнопок, scripts/setup-admin-panel.js для
// провижининга канала и публикации сообщения).
module.exports = {
    handleButton: handlers.handleButton,
    handleSelectMenu: handlers.handleSelectMenu,
    handleModalSubmit: handlers.handleModalSubmit,
    gatherStatus: model.gatherStatus,
    buildPanelMessage: model.buildPanelMessage,
    getConfig: config.load,
    updateConfig: config.update,
};
