// Источники очков активности: сообщения (messageCreate) и присутствие в
// голосовых каналах (voiceStateUpdate + периодический тик из sweep.js,
// который и начисляет накопленные минуты — здесь только отслеживание
// "кто сейчас в голосовом" в памяти процесса).
const model = require('./model');

// key "guildId:userId" → true, пока участник находится в засчитываемом
// голосовом канале. sweep.js на каждом тике читает этот набор и
// начисляет по нему минуты — сама эта карта очков не хранит, только
// текущее присутствие.
const activeVoice = new Map();

function voiceKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

// Не считаем ботов и присутствие в канале ожидания (AFK) — то и другое
// не настоящая активность пользователя.
function isCountableVoiceState(state) {
    if (!state.channelId) return false;
    if (state.channelId === state.guild.afkChannelId) return false;
    if (state.member?.user?.bot) return false;
    return true;
}

// Выдаёт роль уровня и публикует карточку level-up — общий хвост и для
// текстовых сообщений, и для голосового sweep.js, чтобы оба пути не
// дублировали одну и ту же последовательность вызовов.
async function applyLevelUp(client, guild, userId, levelIndex) {
    await model.grantLevelRolesUpTo(guild, userId, levelIndex);
    await model.announceLevelUp(client, guild.id, userId, levelIndex);
}

async function handleMessageCreate(msg) {
    if (!msg.guild || msg.author.bot) return;
    if (!model.canCountMessage(msg.guild.id, msg.author.id)) return;

    const result = await model.addTextPoint(msg.guild.id, msg.author.id);
    if (result.leveledUp) {
        await applyLevelUp(msg.client, msg.guild, msg.author.id, result.levelIndex);
    }
}

// Проверяем только newState — тот же участник не может одновременно
// покидать один канал и заходить в другой отдельными событиями: любое
// изменение (join/leave/move/kick) отражается уже в newState целиком.
function handleVoiceStateUpdate(oldState, newState) {
    const key = voiceKey(newState.guild.id, newState.id);
    if (isCountableVoiceState(newState)) {
        activeVoice.set(key, true);
    } else {
        activeVoice.delete(key);
    }
}

// Восстанавливает activeVoice после рестарта бота: без этого участники,
// уже сидевшие в голосовых каналах до запуска, остались бы невидимы для
// sweep.js до своего следующего voiceStateUpdate (то есть пока сами не
// выйдут/зайдут заново).
async function scanInitialVoiceState(client) {
    for (const guild of client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
            if (!channel.isVoiceBased() || channel.id === guild.afkChannelId) continue;
            for (const member of channel.members.values()) {
                if (member.user.bot) continue;
                activeVoice.set(voiceKey(guild.id, member.id), true);
            }
        }
    }
}

function getActiveVoiceEntries() {
    return Array.from(activeVoice.keys()).map(key => {
        const [guildId, userId] = key.split(':');
        return { guildId, userId };
    });
}

function register(client) {
    client.on('messageCreate', msg => {
        handleMessageCreate(msg).catch(err => console.error('leveling messageCreate:', err));
    });
    client.on('voiceStateUpdate', (oldState, newState) => {
        try {
            handleVoiceStateUpdate(oldState, newState);
        } catch (err) {
            console.error('leveling voiceStateUpdate:', err);
        }
    });
    scanInitialVoiceState(client).catch(err => console.error('leveling initial voice scan:', err));
}

module.exports = {
    register,
    applyLevelUp,
    handleMessageCreate,
    handleVoiceStateUpdate,
    isCountableVoiceState,
    scanInitialVoiceState,
    getActiveVoiceEntries,
};
