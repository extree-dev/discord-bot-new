const model = require('./model');
const sweep = require('./sweep');

// Держит deny-оверрайт роли Muted актуальным и на каналах/категориях,
// созданных уже после первичного провижининга (scripts/setup-roles.js) —
// иначе новый канал остался бы без ограничения, пока кто-то не
// перезапустит скрипт вручную. Оверрайт ставится на КАЖДЫЙ канал, не
// только категории — канал с собственным оверрайтом какой-то другой
// роли иначе может перебить категорийный запрет Muted (у Discord
// канальные оверрайты всегда приоритетнее категорийных для одной и той
// же роли, см. moderation/model.js). channelCreate не срабатывает на
// треды (у них отдельное событие threadCreate, и ThreadChannel вообще не
// поддерживает permissionOverwrites), так что дополнительная проверка
// типа канала здесь не нужна.
function registerChannelProvisioning(client) {
    client.on('channelCreate', channel => {
        model
            .getMutedRole(channel.guild)
            .then(role => role && model.applyMuteOverwrite(channel, role.id))
            .catch(() => {});
    });
}

function register(client) {
    sweep.start(client);
    registerChannelProvisioning(client);
    console.log('Система кастомного мута активирована.');
}

// Публичный API фичи moderation/. Команды и другие фичи (tickets/) идут
// через этот файл, а не через прямой require('../moderation/model') —
// тот же принцип, что и у tickets/index.js.
module.exports = {
    register,
    muteMember: model.muteMember,
    unmuteMember: model.unmuteMember,
    getMutedRole: model.getMutedRole,
    applyMuteOverwrite: model.applyMuteOverwrite,
    getConfig: model.load,
};
