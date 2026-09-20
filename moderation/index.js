const { ChannelType } = require('discord.js');
const model = require('./model');
const sweep = require('./sweep');

// Держит deny-оверрайт роли Muted актуальным и на каналах/категориях,
// созданных уже после первичного провижининга (scripts/setup-roles.js) —
// иначе новая категория осталась бы без ограничения, пока кто-то не
// перезапустит скрипт вручную. Каналы ВНУТРИ категории игнорируем — они
// наследуют оверрайт от родителя, если у них нет своего собственного.
function registerChannelProvisioning(client) {
    client.on('channelCreate', channel => {
        if (channel.type !== ChannelType.GuildCategory && channel.parentId) return;
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
