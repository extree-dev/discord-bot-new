const model = require('./model');
const config = require('./config');

// Публичный API фичи presence/. Команда /status должна идти через этот
// файл, а не через прямой require('../presence/config').
module.exports = {
    register: model.start,
    applyCurrentPresence: model.applyCurrentPresence,
    getConfig: config.load,
    updateConfig: config.update,
    ACTIVITY_TYPES: model.ACTIVITY_TYPES,
    ACTIVITY_LABELS: model.ACTIVITY_LABELS,
    isValidStreamUrl: model.isValidStreamUrl,
};
