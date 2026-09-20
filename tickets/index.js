const handlers = require('./handlers');
const model = require('./model');
const sweep = require('./sweep');
const config = require('./config');

function register(client) {
    handlers.register(client);
    sweep.start(client);
    console.log('Система тикетов активирована.');
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
    buildBugPanelMessage: model.buildBugPanelMessage,
    getConfig: config.load,
    isStaff: model.isStaff,
    canCloseTicket: model.canCloseTicket,
    formatDuration: model.formatDuration,
    aggregateStats: model.aggregateStats,
    reopenTicket: model.reopenTicket,
    postCannedResponse: model.postCannedResponse,
    getOrCreateNotesThread: model.getOrCreateNotesThread,
    CANNED_RESPONSES: model.CANNED_RESPONSES,
    STATUS: model.STATUS,
    STATUS_LABELS: model.STATUS_LABELS,
};
