const model = require('./model');

// Публичный API фичи cases/. /warn, /timeout, /ban, /kick и /case должны
// идти только сюда, а не через прямой require('../cases/model').
module.exports = {
    addCase: model.addCase,
    getCase: model.getCase,
    getCasesForUser: model.getCasesForUser,
    getCasesForGuild: model.getCasesForGuild,
    countRecentCases: model.countRecentCases,
    storeName: model.storeName,
};
