// Доменный слой временных голосовых комнат: кто ими может управлять,
// создание/передача владения/уборка при выходе, сами действия над
// каналом (лок, скрытие, лимит, кик, блок). Роутинг по customId — в
// voice/handlers.js.
const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { load, update } = require('./config');
const security = require('../security');
const { COLORS, formatBody } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');

// Кастомные иконки (Application Emoji), загружены с icons8.com
const CUSTOM_ICONS = {
    lock: '1549165711094718526',
    hide: '1549165712327704586',
    edit: '1549165713992712255',
    limit: '1549165715754328136',
    block: '1549165718258458715',
    unlock: '1549165720892350484',
    crown: '1549165722570203250',
    kick: '1549165725623779449',
};

// Для channel.permissionOverwrites.edit() — объект { флаг: true/false/null }
// ManageChannels владельцу намеренно не даём — управление комнатой
// должно идти через кнопки на панели (rename/limit и т.д. уже покрыты),
// а не через нативный "Edit Channel" в Discord, который эти кнопки
// обходит. MuteMembers/DeafenMembers тоже не даём: серверный мут/глушение
// в Discord действуют на весь сервер, а не на одну комнату — владелец
// мог замутить человека, и тот оставался замьюченным во всех каналах
// после выхода из комнаты. Отключить неугодного можно кнопкой "Кикнуть".
function ownerPermissions() {
    return {
        ViewChannel: true,
        Connect: true,
        MoveMembers: true,
    };
}

// Для guild.channels.create({ permissionOverwrites }) — allow/deny там ждут массив флагов, а не объект
const OWNER_PERMISSION_FLAGS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.MoveMembers,
];

// Discord разрешает переименовать канал только 2 раза за 10 минут. Сверх
// лимита discord.js не падает, а молча ждёт окончания окна (до 10 минут) —
// ответ на модалку не успевал уйти, и участник видел "Взаимодействие не
// удалось". Считаем переименования сами и сразу отвечаем, когда можно.
const RENAME_LIMIT = 2;
const RENAME_WINDOW_MS = 10 * 60 * 1000;
const renameHistory = new Map();

// Повторный заход в триггер сразу после создания комнаты — не новая
// комната: иначе прыжками в триггер можно было наплодить десятки каналов.
const CREATE_COOLDOWN_MS = 30 * 1000;
const lastCreateAt = new Map();

// Периодическая уборка: комнаты, которые остались пустыми, но не были
// удалены (бот перезапускался, пока из комнаты выходили, участника не
// удалось переместить в новую комнату), и записи о каналах, удалённых
// вручную. Свежие комнаты не трогаем — участника в них ещё переносят.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const SWEEP_GRACE_MS = 60 * 1000;
const UNKNOWN_CHANNEL = 10003;

// @everyone в комнате: помимо статуса канала (см. createRoom), запрещены
// приглашение в комнату, запуск активности и звуковая панель — для них
// нет ни кнопки на панели, ни модерирования владельцем, и они позволяют
// притащить в комнату чужих людей/шум в обход владельца.
const ROOM_EVERYONE_DENY = {
    SetVoiceChannelStatus: false,
    CreateInstantInvite: false,
    UseEmbeddedActivities: false,
    UseSoundboard: false,
    UseExternalSounds: false,
};

function isOwner(entry, member) {
    return entry.ownerId === member.id;
}

function resolveTarget(interaction, config) {
    const voiceChannelId = interaction.member.voice.channelId;
    if (!voiceChannelId) {
        return { error: 'Зайди в свою временную комнату (в голосовой канал), чтобы ей управлять.' };
    }
    const entry = config.channels[voiceChannelId];
    if (!entry) {
        return { error: 'Ты сейчас не в временной комнате.' };
    }
    if (!isOwner(entry, interaction.member)) {
        return { error: 'Только владелец комнаты может ей управлять.' };
    }
    const channel = interaction.guild.channels.cache.get(voiceChannelId);
    if (!channel) {
        return { error: 'Комната не найдена.' };
    }
    return { channel, entry };
}

function buildPanelMessage() {
    const container = baseContainer(COLORS.primary)
        .addTextDisplayComponents(
            textDisplay(
                formatBody(
                    'Управление временной комнатой',
                    'Зайди в свою комнату в голосовом канале и жми кнопки — действие применится к ней.'
                )
            )
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            textDisplay(
                [
                    `<:icon_lock:${CUSTOM_ICONS.lock}> \`Закрыть/Открыть — запретить или разрешить вход в комнату\``,
                    `<:icon_hide:${CUSTOM_ICONS.hide}> \`Скрыть/Показать — убрать комнату из списка каналов или вернуть обратно\``,
                    `<:icon_edit:${CUSTOM_ICONS.edit}> \`Переименовать — задать своё название комнаты\``,
                    `<:icon_limit:${CUSTOM_ICONS.limit}> \`Лимит — ограничить число участников в комнате\``,
                    `<:icon_kick:${CUSTOM_ICONS.kick}> \`Кикнуть — отключить участника от комнаты\``,
                    `<:icon_block:${CUSTOM_ICONS.block}> \`Заблокировать — запретить конкретному человеку заходить\``,
                    `<:icon_unlock:${CUSTOM_ICONS.unlock}> \`Разблокировать — снять блокировку с человека\``,
                    `<:icon_crown:${CUSTOM_ICONS.crown}> \`Передать права — сделать другого участника владельцем\``,
                ].join('\n')
            )
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('tempvoice_lock')
            .setEmoji({ id: CUSTOM_ICONS.lock, name: 'icon_lock' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_hide')
            .setEmoji({ id: CUSTOM_ICONS.hide, name: 'icon_hide' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_rename')
            .setEmoji({ id: CUSTOM_ICONS.edit, name: 'icon_edit' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_limit')
            .setEmoji({ id: CUSTOM_ICONS.limit, name: 'icon_limit' })
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('tempvoice_kick')
            .setEmoji({ id: CUSTOM_ICONS.kick, name: 'icon_kick' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_block')
            .setEmoji({ id: CUSTOM_ICONS.block, name: 'icon_block' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_unblock')
            .setEmoji({ id: CUSTOM_ICONS.unlock, name: 'icon_unlock' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_transfer')
            .setEmoji({ id: CUSTOM_ICONS.crown, name: 'icon_crown' })
            .setStyle(ButtonStyle.Secondary)
    );

    return toMessage(container, row1, row2);
}

// cache.get() тихо возвращает undefined, если категория не попала в кэш
// (например, сразу после рестарта бота) — тогда комната молча создавалась
// бы без родителя вместо нужной категории. fetch() — подстраховка на этот
// случай, а не основной путь.
async function resolveCategory(guild, categoryId) {
    if (!categoryId) return null;
    return guild.channels.cache.get(categoryId) ?? (await guild.channels.fetch(categoryId).catch(() => null));
}

function findOwnedRoom(guild, config, memberId) {
    for (const [channelId, entry] of Object.entries(config.channels)) {
        if (entry.ownerId !== memberId) continue;
        const channel = guild.channels.cache.get(channelId);
        if (channel) return channel;
    }
    return null;
}

// Сколько ещё ждать до следующего разрешённого переименования (0 — можно).
function renameWaitMs(channelId, now = Date.now()) {
    const recent = (renameHistory.get(channelId) ?? []).filter(t => now - t < RENAME_WINDOW_MS);
    renameHistory.set(channelId, recent);
    if (recent.length < RENAME_LIMIT) return 0;
    return RENAME_WINDOW_MS - (now - recent[0]);
}

// Сколько ещё ждать до создания следующей комнаты (0 — можно).
function createCooldownMs(memberId, now = Date.now()) {
    const last = lastCreateAt.get(memberId);
    if (last === undefined) return 0;
    return Math.max(0, CREATE_COOLDOWN_MS - (now - last));
}

const LINK_REGEX = /(https?:\/\/|www\.)\S+/i;
const MASS_MENTION_REGEX = /@(everyone|here)\b/i;

// Название комнаты видят все в списке каналов — те же ограничения, что и
// автомодерация в чате: без ссылок, инвайтов, @everyone/@here и
// запрещённых слов из security-config (bannedWords). Возвращает текст
// ошибки или null.
function validateRoomName(name, bannedWords = []) {
    if (!name) return 'Название не может быть пустым.';
    if (security.isInviteLink(name) || security.isPhishingLink(name) || LINK_REGEX.test(name))
        return 'Ссылки и приглашения в названии комнаты запрещены.';
    if (MASS_MENTION_REGEX.test(name)) return 'Упоминания @everyone и @here в названии комнаты запрещены.';
    const lower = name.toLowerCase();
    if (bannedWords.some(w => w && lower.includes(w.toLowerCase()))) {
        return 'Название содержит запрещённое слово.';
    }
    return null;
}

async function createRoom(state, config) {
    const guild = state.guild;
    const member = state.member;

    // Уже есть своя комната — возвращаем в неё, а не создаём вторую.
    // Возвращаем её ID, чтобы handleVoiceStateUpdate не удалил эту же
    // комнату как опустевшую, если участник вышел в триггер именно из неё.
    const owned = findOwnedRoom(guild, config, member.id);
    if (owned) {
        await member.voice.setChannel(owned).catch(err => {
            console.error('tempVoice: не удалось вернуть участника в его комнату:', err.message);
        });
        return owned.id;
    }

    const wait = createCooldownMs(member.id);
    if (wait > 0) {
        await member.voice.disconnect('Слишком частое создание временных комнат').catch(() => {});
        await member.send(`Новую временную комнату можно создать через ${Math.ceil(wait / 1000)} сек.`).catch(() => {});
        return;
    }
    // Ставим до первого await — два быстрых захода в триггер подряд
    // иначе оба успевали бы пройти проверку и создать по комнате.
    lastCreateAt.set(member.id, Date.now());
    // Комнаты создаются в отдельной категории (roomsCategoryId), а не в
    // той же, где лежат триггер-канал и панель управления (categoryId) —
    // иначе та категория зарастает десятками комнат участников. Если
    // roomsCategoryId ещё не настроен (старый деплой, scripts/setup-temp-voice.js
    // не перезапускали) — используем старую категорию как запасной
    // вариант, чтобы комната хотя бы не осталась без родителя вообще.
    const category =
        (await resolveCategory(guild, config.roomsCategoryId)) ?? (await resolveCategory(guild, config.categoryId));

    const name = `Комната ${member.displayName}`.slice(0, 95);

    const overwrites = category
        ? category.permissionOverwrites.cache.map(ow => ({ id: ow.id, allow: ow.allow, deny: ow.deny, type: ow.type }))
        : [];
    overwrites.push({ id: member.id, allow: OWNER_PERMISSION_FLAGS });

    const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: category?.id ?? null,
        userLimit: config.defaultLimit,
        permissionOverwrites: overwrites,
    });

    // Никто, включая владельца, не должен ставить нативный "статус
    // голосового канала" Discord — управление комнатой только через
    // кнопки на панели, а не через отдельную функцию клиента. По той же
    // причине запрещены приглашение в комнату, запуск активности
    // (игры/просмотр вместе) и звуковая панель — это неуправляемые
    // ботом способы привести в комнату чужих людей/шум, для которых нет
    // ни кнопки на панели, ни какого-либо модерирования владельцем.
    await channel.permissionOverwrites.edit(guild.roles.everyone.id, ROOM_EVERYONE_DENY).catch(() => {});

    await member.voice.setChannel(channel).catch(err => {
        console.error('tempVoice: не удалось переместить участника в новую комнату:', err.message);
    });

    // Не пишем через переданный `config` — он был загружен до await'ов
    // выше (создание канала, перемещение участника) и может быть уже
    // устаревшим. update() перечитывает файл заново перед записью.
    await update(cfg => {
        cfg.channels[channel.id] = { ownerId: member.id, createdAt: Date.now() };
    });
}

// Регистрирует уже существующий voice-канал (созданный не через
// createRoom — например, tickets/model.js для обсуждения тикета
// голосом) в системе временных комнат, чтобы его удалением при
// опустении занимался уже существующий handleLeave(), а не отдельная
// копия той же логики в вызывающей фиче.
async function trackRoom(channelId, ownerId) {
    await update(cfg => {
        cfg.channels[channelId] = { ownerId, createdAt: Date.now() };
    });
}

// Обратная сторона trackRoom() — вызывающая фича сама удалила канал
// (например, тикет закрылся вместе со своей голосовой комнатой) и
// снимает его с учёта, чтобы handleLeave() не пытался работать с уже
// не существующим каналом.
async function untrackRoom(channelId) {
    await update(cfg => {
        delete cfg.channels[channelId];
    });
}

async function transferOwnership(channel, entry, newOwnerId) {
    await channel.permissionOverwrites.delete(entry.ownerId).catch(() => {});
    await channel.permissionOverwrites.edit(newOwnerId, ownerPermissions()).catch(() => {});
    entry.ownerId = newOwnerId;

    await update(cfg => {
        if (cfg.channels[channel.id]) cfg.channels[channel.id].ownerId = newOwnerId;
    });
}

async function handleLeave(oldState) {
    const config = await load();
    const channelId = oldState.channelId;
    const entry = config.channels[channelId];
    if (!entry) return;

    const channel = oldState.guild.channels.cache.get(channelId);
    if (!channel) {
        await update(cfg => {
            delete cfg.channels[channelId];
        });
        return;
    }

    if (channel.members.size === 0) {
        await update(cfg => {
            delete cfg.channels[channelId];
        });
        await channel.delete('Временная комната пуста').catch(() => {});
    }

    // Владение НЕ передаётся автоматически, когда владелец выходит из
    // комнаты (даже временно) — иначе любой, кто остался в канале в
    // этот момент, получал бы полный контроль без согласия владельца.
    // Осознанная передача прав — через кнопку "Передать права"
    // (tempvoice_transfer), которая вызывает transferOwnership() явно.
}

async function handleVoiceStateUpdate(oldState, newState) {
    if (newState.member?.user.bot) return;
    // Мут/глушение/стрим/камера тоже приходят как voiceStateUpdate, но
    // канал при этом не меняется — не ходим за конфигом в базу зря.
    if (oldState.channelId === newState.channelId) return;
    const config = await load();
    if (!config.triggerChannelId) return;

    let returnedTo = null;
    if (newState.channelId === config.triggerChannelId && oldState.channelId !== config.triggerChannelId) {
        returnedTo = await createRoom(newState, config);
    }

    if (oldState.channelId && oldState.channelId !== returnedTo) {
        await handleLeave(oldState);
    }
}

// --- Действия над уже найденной комнатой (channel/entry резолвит
// resolveTarget в handlers.js) — каждая возвращает данные, нужные для
// текста ответа, но сам interaction.reply() остаётся в handlers.js.

async function toggleLock(channel, everyoneRole) {
    const current = channel.permissionOverwrites.cache.get(everyoneRole.id);
    const wasLocked = current?.deny.has(PermissionFlagsBits.Connect) ?? false;
    await channel.permissionOverwrites.edit(everyoneRole, { Connect: wasLocked ? null : false });
    return { wasLocked };
}

async function toggleHide(channel, everyoneRole) {
    const current = channel.permissionOverwrites.cache.get(everyoneRole.id);
    const wasHidden = current?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
    await channel.permissionOverwrites.edit(everyoneRole, { ViewChannel: wasHidden ? null : false });
    return { wasHidden };
}

// Ошибки не глотаем — раньше при отказе Discord участнику всё равно
// отвечали "Комната переименована". Лимит переименований проверяет
// вызывающий код через renameWaitMs() до вызова.
async function renameRoom(channel, name) {
    await channel.setName(name);
    renameHistory.set(channel.id, [...(renameHistory.get(channel.id) ?? []), Date.now()]);
}

async function setRoomLimit(channel, limit) {
    await channel.setUserLimit(limit);
}

// Участники комнаты, кроме владельца и ботов — кандидаты для кика и
// передачи прав (раньше меню предлагало вообще всех участников сервера).
function getRoomMembers(channel, entry) {
    return [...channel.members.values()].filter(m => m.id !== entry.ownerId && !m.user.bot);
}

async function kickFromRoom(targetMember) {
    await targetMember.voice.disconnect('Отключён владельцем комнаты').catch(() => {});
}

async function blockInRoom(channel, targetId) {
    await channel.permissionOverwrites.edit(targetId, { Connect: false, ViewChannel: false }).catch(() => {});
    const memberInChannel = channel.members.get(targetId);
    if (memberInChannel) {
        await memberInChannel.voice.disconnect('Заблокирован владельцем комнаты').catch(() => {});
    }
}

async function unblockInRoom(channel, targetId) {
    await channel.permissionOverwrites.delete(targetId).catch(() => {});
}

// ID заблокированных участников комнаты (без @everyone и без владельца) —
// handlers.js сам резолвит их в User для подписи пунктов select-меню.
function getBlockedMemberIds(channel, entry, everyoneId) {
    return channel.permissionOverwrites.cache
        .filter(ow => ow.id !== everyoneId && ow.id !== entry.ownerId && ow.deny.has(PermissionFlagsBits.Connect))
        .map(ow => ow.id);
}

async function fetchRoomChannel(client, channelId) {
    const cached = client.channels.cache.get(channelId);
    if (cached) return { channel: cached };
    try {
        return { channel: await client.channels.fetch(channelId) };
    } catch (err) {
        // Удалять запись только когда Discord прямо ответил "канала нет" —
        // сетевая ошибка не повод забыть о живой комнате.
        return { channel: null, missing: err.code === UNKNOWN_CHANNEL };
    }
}

async function sweepRooms(client, now = Date.now()) {
    const config = await load();
    for (const [channelId, entry] of Object.entries(config.channels)) {
        const { channel, missing } = await fetchRoomChannel(client, channelId);
        if (!channel) {
            if (missing) {
                await update(cfg => {
                    delete cfg.channels[channelId];
                });
            }
            continue;
        }

        if (channel.members.size === 0) {
            if (now - (entry.createdAt ?? 0) < SWEEP_GRACE_MS) continue;
            await update(cfg => {
                delete cfg.channels[channelId];
            });
            await channel.delete('Временная комната пуста').catch(() => {});
            continue;
        }

        // Комнаты, созданные до отказа от MuteMembers/DeafenMembers у
        // владельца, — снимаем эти права и с них.
        const ownerOverwrite = channel.permissionOverwrites.cache.get(entry.ownerId);
        if (
            ownerOverwrite?.allow.has(PermissionFlagsBits.MuteMembers) ||
            ownerOverwrite?.allow.has(PermissionFlagsBits.DeafenMembers)
        ) {
            await channel.permissionOverwrites
                .edit(entry.ownerId, { MuteMembers: null, DeafenMembers: null })
                .catch(() => {});
        }

        // Комнаты, созданные до запрета приглашений/активностей/звуковой
        // панели (см. ROOM_EVERYONE_DENY в createRoom), — донастраиваем
        // и их, а не только новые.
        const everyoneId = channel.guild.roles.everyone.id;
        const everyoneOverwrite = channel.permissionOverwrites.cache.get(everyoneId);
        const missingDeny = Object.entries(ROOM_EVERYONE_DENY).some(
            ([flag]) => !everyoneOverwrite?.deny.has(PermissionFlagsBits[flag])
        );
        if (missingDeny) {
            await channel.permissionOverwrites.edit(everyoneId, ROOM_EVERYONE_DENY).catch(() => {});
        }
    }
}

function startSweep(client) {
    const run = () => sweepRooms(client).catch(err => console.error('tempVoice sweep:', err));
    run();
    setInterval(run, SWEEP_INTERVAL_MS);
}

module.exports = {
    CUSTOM_ICONS,
    ownerPermissions,
    OWNER_PERMISSION_FLAGS,
    ROOM_EVERYONE_DENY,
    isOwner,
    resolveTarget,
    buildPanelMessage,
    createRoom,
    trackRoom,
    untrackRoom,
    transferOwnership,
    handleLeave,
    handleVoiceStateUpdate,
    toggleLock,
    toggleHide,
    renameRoom,
    setRoomLimit,
    kickFromRoom,
    blockInRoom,
    unblockInRoom,
    getBlockedMemberIds,
    getRoomMembers,
    validateRoomName,
    renameWaitMs,
    createCooldownMs,
    sweepRooms,
    startSweep,
};
