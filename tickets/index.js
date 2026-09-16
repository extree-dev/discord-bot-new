const tickets = require('./tickets');

function register(client) {
    tickets.register(client);
    console.log('Система тикетов активирована.');
}

module.exports = {
    register,
    handleButton: tickets.handleButton,
    handleSelectMenu: tickets.handleSelectMenu,
};
