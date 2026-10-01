const handlers = require('./handlers');
const model = require('./model');
const config = require('./config');
const sweep = require('./sweep');

function register(client) {
    handlers.register(client);
    sweep.start(client);
    console.log('Система обращений (тикеты) активирована (авто-эскалация + авто-закрытие неактивных).');
}

// Публичный API фичи tickets/. Команды и скрипты настройки должны идти
// через этот файл, а не через прямые require('../tickets/model') или
// require('../tickets/config').
module.exports = {
    register,
    handleButton: handlers.handleButton,
    handleSelectMenu: handlers.handleSelectMenu,
    handleModalSubmit: handlers.handleModalSubmit,
    buildPanelMessage: model.buildPanelMessage,
    buildManagementPanelMessage: model.buildManagementPanelMessage,
    getConfig: config.load,
    isStaff: model.isStaff,
    countRecentReportsOn: model.countRecentReportsOn,
    REPORT_HISTORY_WINDOW_MS: model.REPORT_HISTORY_WINDOW_MS,
};
