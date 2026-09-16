const tempChannels = require('./tempChannels');

function register(client) {
    tempChannels.register(client);
    console.log('Система временных голосовых комнат активирована.');
}

module.exports = {
    register,
    handleButton: tempChannels.handleButton,
    handleModalSubmit: tempChannels.handleModalSubmit,
    handleSelectMenu: tempChannels.handleSelectMenu,
};
