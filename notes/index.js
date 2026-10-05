const model = require('./model');

// Публичный API фичи notes/. Команда /note должна идти только сюда, а
// не через прямой require('../notes/model').
module.exports = {
    addNote: model.addNote,
    getNotes: model.getNotes,
    removeNote: model.removeNote,
    storeName: model.storeName,
};
