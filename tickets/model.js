// Доменный слой тикетов: правила (кто staff, чей это тикет, какой статус),
// создание/захват/закрытие/переоткрытие тикета, построение embed/кнопок,
// агрегация статистики. Роутинг по customId и события Discord — в
// tickets/handlers.js и tickets/sweep.js.
const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require('discord.js');
const { load, update } = require('./config');
const { COLORS, baseEmbed, formatBody, infoEmbed } = require('../utils/embeds');
const voice = require('../voice');

const STATUS = {
    OPEN: 'open',
    WAITING_ON_USER: 'waiting_on_user',
    RESOLVED: 'resolved',
};

const STATUS_LABELS = {
    [STATUS.OPEN]: 'Открыт',
    [STATUS.WAITING_ON_USER]: 'Ждём ответа автора',
    [STATUS.RESOLVED]: 'Решён',
};

const STATUS_COLORS = {
    [STATUS.OPEN]: COLORS.primary,
    [STATUS.WAITING_ON_USER]: COLORS.warning,
    [STATUS.RESOLVED]: COLORS.success,
};

const REASONS = [
    { value: 'general', label: 'Общий вопрос' },
    { value: 'bug', label: 'Баг / техническая проблема' },
    {
        value: 'report',
        label: 'Жалоба на игрока',
        extraFieldLabel: 'Ник нарушителя и ссылка на сообщение-доказательство',
    },
    { value: 'payment', label: 'Донат / платежи', extraFieldLabel: 'ID платежа или транзакции' },
    { value: 'other', label: 'Другое' },
];

// Готовые ответы для частых вопросов — /ticket reply <ключ> публикует
// текст в тред от имени бота, чтобы не копипастить одно и то же вручную.
const CANNED_RESPONSES = {
    greeting: {
        label: 'Приветствие',
        text: 'Здравствуйте! Спасибо за обращение — уже разбираемся, ответим в ближайшее время.',
    },
    need_more_info: {
        label: 'Нужно больше информации',
        text: 'Уточните, пожалуйста, подробности — скриншоты или точное описание проблемы помогут быстрее разобраться.',
    },
    payment_info: {
        label: 'Нужны детали платежа',
        text: 'Для проверки платежа пришлите, пожалуйста, ID транзакции и способ оплаты.',
    },
    closing_soon: {
        label: 'Напоминание перед закрытием',
        text: 'Если вопрос решён — можно закрыть тикет кнопкой «Закрыть». Если нет, напишите, чем можем помочь дальше.',
    },
};

function isStaff(config, member) {
    if (config.supportRoleId && member.roles.cache.has(config.supportRoleId)) return true;
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers)
    );
}

// Только незакрытые тикеты считаются "уже открытым обращением" — решённые
// остаются в сторе как история (для /mytickets и /ticket stats), поэтому
// findTicketByOwner(), в отличие от старой версии, не должен их находить.
function findOpenTicketByOwner(config, userId) {
    return Object.entries(config.tickets).find(([, t]) => t.ownerId === userId && t.status !== STATUS.RESOLVED);
}

// Пока тикет не взят в работу — закрыть может автор или любой staff.
// После взятия в работу круг сужается: автор, тот, кто взял, или
// админ (просто модератор — уже нет, чтобы не мешать тому, кто ведёт
// обращение).
function canCloseTicket(config, entry, member) {
    const isOwner = entry.ownerId === member.id;
    if (!entry.claimedBy) {
        return isOwner || isStaff(config, member);
    }
    const isClaimer = entry.claimedBy === member.id;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    return isOwner || isClaimer || isAdmin;
}

// "2 д 3 ч", "45 мин", "<1 мин" — используется в /ticket list, /ticket
// stats и сообщениях эскалации. Чистая функция — без обращений к Discord.
function formatDuration(ms) {
    if (ms == null || ms < 0) return '—';
    if (ms < 60000) return '<1 мин';
    const totalMinutes = Math.round(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days} д`);
    if (hours) parts.push(`${hours} ч`);
    if (minutes && !days) parts.push(`${minutes} мин`);
    return parts.join(' ') || '<1 мин';
}

// Сколько тикетов закрыл каждый staff и средняя оценка — по всем записям
// в сторе (закрытые тикеты не удаляются, только помечаются RESOLVED).
function aggregateStats(config) {
    const perStaff = {};
    let ratingSum = 0;
    let ratedCount = 0;

    function getStats(staffId) {
        if (!perStaff[staffId]) {
            perStaff[staffId] = { closed: 0, totalResolveMs: 0, ratingSum: 0, ratedCount: 0 };
        }
        return perStaff[staffId];
    }

    for (const entry of Object.values(config.tickets)) {
        if (entry.status !== STATUS.RESOLVED) continue;
        if (typeof entry.rating === 'number') {
            ratingSum += entry.rating;
            ratedCount += 1;
            // Оценка относится к тому, кто вёл тикет (claimedBy), а не к
            // тому, кто его закрыл (closedBy) — закрыть может и сам автор
            // обращения, и он не "модератор" для целей рейтинга.
            if (entry.claimedBy) {
                const stats = getStats(entry.claimedBy);
                stats.ratingSum += entry.rating;
                stats.ratedCount += 1;
            }
        }
        if (!entry.closedBy) continue;
        const stats = getStats(entry.closedBy);
        stats.closed += 1;
        if (typeof entry.closedAt === 'number' && typeof entry.createdAt === 'number') {
            stats.totalResolveMs += entry.closedAt - entry.createdAt;
        }
    }

    return { perStaff, averageRating: ratedCount ? ratingSum / ratedCount : null, ratedCount };
}

function buildPanelMessage(guild) {
    const embed = baseEmbed(COLORS.primary)
        .setDescription(
            `${formatBody('Поддержка сервера')}\n\n` +
                'Нужна помощь? Нажми кнопку ниже, выбери тему и опиши проблему в форме — мы откроем приватный тред с ' +
                'командой поддержки, который увидишь только ты и staff.\n\n' +
                '**Темы обращений:**\n' +
                REASONS.map(r => `\`${r.label}\``).join('\n')
        )
        .setThumbnail(guild?.iconURL() ?? null)
        .setFooter({ text: guild?.name ?? 'Поддержка' });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('Открыть тикет').setStyle(ButtonStyle.Primary)
    );
    return { embeds: [embed], components: [row] };
}

function buildTicketControlRow() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Взять в работу').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_adduser')
                .setLabel('Добавить участника')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Закрыть').setStyle(ButtonStyle.Danger)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_voice')
                .setLabel('Обсудить голосом')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_note').setLabel('Заметка (staff)').setStyle(ButtonStyle.Secondary)
        ),
    ];
}

function buildTicketEmbed(entry) {
    return baseEmbed(STATUS_COLORS[entry.status] ?? COLORS.primary)
        .setDescription(`${formatBody(`Тикет #${entry.number}`, entry.description)}`)
        .addFields(
            { name: 'Тема', value: entry.reason, inline: true },
            { name: 'Статус', value: STATUS_LABELS[entry.status] ?? entry.status, inline: true },
            { name: 'Взял в работу', value: entry.claimedBy ? `<@${entry.claimedBy}>` : 'никто', inline: true }
        );
}

async function createTicket(interaction, reason, description) {
    const guild = interaction.guild;
    const member = interaction.member;

    // Проверка "тикет уже есть" и резервирование номера должны быть
    // одной атомарной операцией — иначе два клика (или два разных
    // пользователя, задевших counter почти одновременно) могут
    // получить один и тот же номер. Лок держим только на это быстрое
    // чтение+инкремент, не на медленный API-вызов создания треда.
    const reservation = await update(config => {
        const existing = findOpenTicketByOwner(config, member.id);
        if (existing) {
            return { error: `У тебя уже открыт тикет: <#${existing[0]}>` };
        }
        config.counter += 1;
        return {
            number: config.counter,
            panelChannelId: config.panelChannelId,
            supportRoleId: config.supportRoleId,
            reasonRoleId: config.reasonRoleIds[reason.value] ?? null,
        };
    });

    if (reservation.error) return { error: reservation.error };

    const { number, panelChannelId, supportRoleId, reasonRoleId } = reservation;
    const panelChannel = panelChannelId ? guild.channels.cache.get(panelChannelId) : null;
    if (!panelChannel) {
        return { error: 'Система тикетов не настроена (нет канала для тредов). Обратись к администратору.' };
    }

    const thread = await panelChannel.threads.create({
        name: `тикет-${number}-${member.user.username}`.slice(0, 95).toLowerCase(),
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Тикет #${number} от ${member.user.tag}`,
    });
    await thread.members.add(member.id).catch(() => {});

    const now = Date.now();
    const entry = {
        number,
        ownerId: member.id,
        guildId: guild.id,
        reason: reason.label,
        description,
        claimedBy: null,
        status: STATUS.OPEN,
        isThread: true,
        createdAt: now,
        lastActivityAt: now,
        claimedAt: null,
        closedAt: null,
        closedBy: null,
        escalatedAt: null,
        warnedAt: null,
        rating: null,
        ratedAt: null,
        notesThreadId: null,
        voiceChannelId: null,
        rootMessageId: null,
    };
    await update(cfg => {
        cfg.tickets[thread.id] = entry;
    });

    const pings = [supportRoleId, reasonRoleId].filter(Boolean);
    const uniquePings = [...new Set(pings)].map(id => `<@&${id}>`);

    // rootMessageId запоминаем, чтобы claim/reopen/смена статуса могли
    // обновить именно это сообщение в месте, а не только слать новое —
    // иначе "Взял в работу: никто" навсегда остаётся в начале треда.
    const rootMessage = await thread.send({
        content: `${member}${uniquePings.length ? ' ' + uniquePings.join(' ') : ''}`,
        embeds: [buildTicketEmbed(entry)],
        components: buildTicketControlRow(),
    });
    await update(cfg => {
        const e = cfg.tickets[thread.id];
        if (e) e.rootMessageId = rootMessage.id;
    });

    return { thread };
}

// Перерисовывает embed стартового сообщения тикета (тема/статус/кто
// взял в работу) актуальными данными — вызывается после claim, любой
// активности в треде и reopen, чтобы это сообщение не застревало на
// "Взял в работу: никто" после того, как тикет уже давно взяли.
async function updateTicketRootMessage(client, threadId, entry) {
    if (!entry?.rootMessageId) return;
    const thread = client.channels.cache.get(threadId) ?? (await client.channels.fetch(threadId).catch(() => null));
    if (!thread) return;
    const message = await thread.messages.fetch(entry.rootMessageId).catch(() => null);
    if (!message) return;
    await message.edit({ embeds: [buildTicketEmbed(entry)] }).catch(() => {});
}

// Атомарный захват тикета: перечитывает свежие данные внутри лока и
// проверяет claimedBy ещё раз (вдруг кто-то другой забрал тикет за то
// время, пока вызывающий код читал config до этого) и сразу применяет
// side-эффект (добавление в тред) — доступ к треду такая же часть
// "захвата", как и запись в БД.
async function claimTicket(interaction) {
    const claim = await update(cfg => {
        const entry = cfg.tickets[interaction.channelId];
        if (!entry) return { status: 'gone' };
        if (entry.claimedBy) return { status: 'already-claimed', claimedBy: entry.claimedBy };
        entry.claimedBy = interaction.user.id;
        entry.claimedAt = Date.now();
        entry.status = STATUS.OPEN;
        return { status: 'claimed', entry };
    });

    if (claim.status !== 'claimed') return claim;

    if (interaction.channel.isThread()) {
        await interaction.channel.members.add(interaction.user.id).catch(() => {});
    } else {
        // Обратная совместимость: тикет создан по старой схеме (обычный
        // канал), до перехода на треды.
        await interaction.channel.permissionOverwrites
            .edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ManageMessages: true,
                ReadMessageHistory: true,
            })
            .catch(() => {});
    }

    return claim;
}

// Даёт участнику доступ к тикету и возвращает его User (для сообщения-
// подтверждения) — сама выдача доступа такая же часть домена "добавить
// участника в тикет", как и то, кому конкретно это разрешено.
async function addTicketMember(interaction, targetId) {
    if (interaction.channel.isThread()) {
        await interaction.channel.members.add(targetId).catch(() => {});
    } else {
        await interaction.channel.permissionOverwrites
            .edit(targetId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true })
            .catch(() => {});
    }
    return interaction.guild.members.cache.get(targetId)?.user ?? interaction.client.users.cache.get(targetId) ?? null;
}

// Голосовая комната для обсуждения тикета — создаётся как обычный voice-
// канал, но регистрируется в системе временных комнат (voice.trackRoom),
// чтобы её удаление при опустении обрабатывал уже существующий механизм
// tempvoice, а не отдельная копия той же логики здесь.
async function createDiscussionVoiceChannel(interaction, entry) {
    const guild = interaction.guild;
    const config = await load();
    const category = config.categoryId ? guild.channels.cache.get(config.categoryId) : null;

    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: entry.ownerId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        },
    ];
    if (entry.claimedBy && entry.claimedBy !== entry.ownerId) {
        overwrites.push({
            id: entry.claimedBy,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        });
    }

    const channel = await guild.channels.create({
        name: `тикет-${entry.number}-голос`.slice(0, 95).toLowerCase(),
        type: ChannelType.GuildVoice,
        parent: category?.id ?? null,
        permissionOverwrites: overwrites,
    });

    await voice.trackRoom(channel.id, entry.ownerId);
    return channel;
}

// Переиспользует уже созданную для этого тикета голосовую комнату,
// если она ещё существует (повторный клик "Обсудить голосом" не должен
// плодить второй канал и терять ссылку на первый), иначе создаёт новую
// и запоминает её id на entry — без этого closeTicket не знал бы, какой
// канал удалять при закрытии тикета.
async function getOrCreateDiscussionVoiceChannel(interaction, entry) {
    if (entry.voiceChannelId) {
        const existing =
            interaction.guild.channels.cache.get(entry.voiceChannelId) ??
            (await interaction.guild.channels.fetch(entry.voiceChannelId).catch(() => null));
        if (existing) return { channel: existing, created: false };
    }

    const channel = await createDiscussionVoiceChannel(interaction, entry);
    await update(cfg => {
        const e = cfg.tickets[interaction.channelId];
        if (e) e.voiceChannelId = channel.id;
    });
    return { channel, created: true };
}

// Приватный тред с внутренними заметками staff, отдельный от основного
// тикета (чтобы автор обращения их не видел) — создаётся лениво при
// первом /ticket note и переиспользуется дальше. Участники добавляются
// по одному по мере использования команды, а не массово по роли — Discord
// не даёт добавить в тред "всех с ролью X" одним вызовом API.
async function getOrCreateNotesThread(interaction, entry) {
    if (entry.notesThreadId) {
        const existing =
            interaction.guild.channels.cache.get(entry.notesThreadId) ??
            (await interaction.guild.channels.fetch(entry.notesThreadId).catch(() => null));
        if (existing) return existing;
    }

    const parent = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
    const notesThread = await parent.threads.create({
        name: `тикет-${entry.number}-заметки`.slice(0, 95).toLowerCase(),
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Заметки staff по тикету #${entry.number}`,
    });

    await update(cfg => {
        if (cfg.tickets[interaction.channelId]) cfg.tickets[interaction.channelId].notesThreadId = notesThread.id;
    });

    return notesThread;
}

async function closeTicket(guild, channel, entry, closedBy) {
    const config = await load();

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const sorted = messages ? [...messages.values()].reverse() : [];
    const lines = sorted.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || '(вложение/embed)'}`);
    const transcriptText = lines.length ? lines.join('\n') : 'Сообщений нет.';
    const transcript = new AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), {
        name: `ticket-${entry.number}.txt`,
    });

    const now = Date.now();
    const logChannel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
    if (logChannel) {
        const owner = await guild.members.fetch(entry.ownerId).catch(() => null);
        await logChannel
            .send({
                embeds: [
                    baseEmbed(COLORS.primary)
                        .setDescription(formatBody(`Тикет #${entry.number} закрыт`))
                        .addFields(
                            { name: 'Открыл', value: owner ? `${owner}` : entry.ownerId, inline: true },
                            { name: 'Тема', value: entry.reason, inline: true },
                            {
                                name: 'Закрыл',
                                value: closedBy ? `<@${closedBy}>` : 'автоматически (неактивность)',
                                inline: true,
                            },
                            {
                                name: 'Взял в работу',
                                value: entry.claimedBy ? `<@${entry.claimedBy}>` : 'никто',
                                inline: true,
                            },
                            { name: 'Время решения', value: formatDuration(now - entry.createdAt), inline: true }
                        ),
                ],
                files: [transcript],
            })
            .catch(() => {});
    }

    // Запись о тикете НЕ удаляется (в отличие от старой версии) — она
    // остаётся в сторе со статусом RESOLVED для /mytickets и /ticket
    // stats. Через update(), а не "load-в-начале-функции + save()" —
    // между началом closeTicket и этой строкой были await'ы (fetch
    // сообщений, отправка лога), за которые кто-то другой мог успеть
    // изменить данные тикетов.
    await update(cfg => {
        const e = cfg.tickets[channel.id];
        if (!e) return;
        e.status = STATUS.RESOLVED;
        e.closedAt = now;
        e.closedBy = closedBy;
        pruneOldResolved(cfg);
    });

    // Побочные ресурсы тикета (голосовая комната для обсуждения, тред
    // с внутренними заметками staff) не нужны после закрытия — если их
    // не убрать явно, они остаются висеть: голосовой канал — до тех
    // пор, пока кто-то не зайдёт и не выйдет из него, тред с заметками
    // — навсегда (архивировать его бессмысленно, реопенить тикет не
    // восстанавливает доступ к заметкам отдельно).
    if (entry.notesThreadId) {
        const notesThread =
            guild.channels.cache.get(entry.notesThreadId) ??
            (await guild.channels.fetch(entry.notesThreadId).catch(() => null));
        await notesThread?.delete('Тикет закрыт').catch(() => {});
    }
    if (entry.voiceChannelId) {
        const voiceChannel =
            guild.channels.cache.get(entry.voiceChannelId) ??
            (await guild.channels.fetch(entry.voiceChannelId).catch(() => null));
        await voiceChannel?.delete('Тикет закрыт').catch(() => {});
        await voice.untrackRoom(entry.voiceChannelId);
    }

    await channel
        .send({
            embeds: [baseEmbed(COLORS.danger).setDescription(formatBody('Тикет закрывается', 'Через 5 секунд...'))],
        })
        .catch(() => {});

    setTimeout(async () => {
        if (channel.isThread()) {
            await channel.setLocked(true, 'Тикет закрыт').catch(() => {});
            await channel.setArchived(true, 'Тикет закрыт').catch(() => {});
        } else {
            await channel.delete('Тикет закрыт').catch(() => {});
        }
    }, 5000);

    return { closedAt: now };
}

// Хранить резолвнутые тикеты вечно — не лучшая идея (БД будет только
// расти), но и терять историю сразу тоже не нужно (нужна для /mytickets,
// /ticket stats). Компромисс: держим последние KEEP_RESOLVED закрытых
// тикетов, старые вычищаем. Вызывается изнутри update(), мутирует cfg.
const KEEP_RESOLVED = 300;
function pruneOldResolved(cfg) {
    const resolved = Object.entries(cfg.tickets)
        .filter(([, e]) => e.status === STATUS.RESOLVED)
        .sort(([, a], [, b]) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
    const excess = resolved.length - KEEP_RESOLVED;
    for (let i = 0; i < excess; i++) {
        delete cfg.tickets[resolved[i][0]];
    }
}

// Три чистые функции для sweep.js — принимают config и текущее время,
// не трогают Discord API, поэтому легко тестируются без моков.
function findTicketsToEscalate(config, now) {
    return Object.entries(config.tickets).filter(
        ([, e]) =>
            e.isThread &&
            e.status !== STATUS.RESOLVED &&
            !e.claimedBy &&
            !e.escalatedAt &&
            now - e.createdAt >= config.claimTimeoutMs
    );
}

function findTicketsToWarn(config, now) {
    return Object.entries(config.tickets).filter(
        ([, e]) => e.status !== STATUS.RESOLVED && !e.warnedAt && now - e.lastActivityAt >= config.inactivityWarnMs
    );
}

function findTicketsToAutoClose(config, now) {
    return Object.entries(config.tickets).filter(
        ([, e]) => e.status !== STATUS.RESOLVED && e.warnedAt && now - e.warnedAt >= config.inactivityCloseMs
    );
}

// Готовый ответ из CANNED_RESPONSES, отправленный от имени бота в
// текущий тред — считается активностью staff (см. recordActivity).
async function postCannedResponse(interaction, key) {
    const canned = CANNED_RESPONSES[key];
    if (!canned) return { error: 'Неизвестный шаблон ответа.' };
    await interaction.channel.send({ embeds: [infoEmbed(canned.text, canned.label)] });
    const updatedEntry = await recordActivity(interaction.channelId, false);
    if (updatedEntry) await updateTicketRootMessage(interaction.client, interaction.channelId, updatedEntry);
    return {};
}

async function markEscalated(threadId) {
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (e) e.escalatedAt = Date.now();
    });
}

async function markWarned(threadId) {
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (e) e.warnedAt = Date.now();
    });
}

async function reopenTicket(guild, number) {
    const config = await load();
    const found = Object.entries(config.tickets).find(([, t]) => t.number === number);
    if (!found) return { error: `Тикет #${number} не найден.` };
    const [threadId, entry] = found;
    if (entry.status !== STATUS.RESOLVED) return { error: `Тикет #${number} не закрыт.` };

    const thread = guild.channels.cache.get(threadId) ?? (await guild.channels.fetch(threadId).catch(() => null));
    if (!thread) {
        return { error: `Тред тикета #${number} не найден (возможно, был создан по старой схеме и уже удалён).` };
    }

    if (thread.isThread()) {
        await thread.setArchived(false, 'Тикет переоткрыт').catch(() => {});
        await thread.setLocked(false, 'Тикет переоткрыт').catch(() => {});
        await thread.members.add(entry.ownerId).catch(() => {});
    }

    const now = Date.now();
    let updatedEntry = null;
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (!e) return;
        e.status = STATUS.OPEN;
        e.closedAt = null;
        e.closedBy = null;
        e.lastActivityAt = now;
        updatedEntry = e;
    });

    if (updatedEntry) {
        await thread.send({ embeds: [buildTicketEmbed(updatedEntry)] }).catch(() => {});
        await updateTicketRootMessage(guild.client, threadId, updatedEntry);
    }

    return { thread };
}

// DM автору с просьбой оценить работу поддержки — отправляется после
// закрытия тикета. Молча ничего не делает, если DM закрыты (catch).
async function sendRatingRequest(client, entry, threadId) {
    const user = await client.users.fetch(entry.ownerId).catch(() => null);
    if (!user) return;

    const embed = baseEmbed(COLORS.primary).setDescription(
        formatBody('Оцени поддержку', `Как тебе помогли с тикетом #${entry.number}? Выбери оценку от 1 до 5.`)
    );
    const row = new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map(n =>
            new ButtonBuilder()
                .setCustomId(`ticket_rate:${threadId}:${n}`)
                .setLabel(`${n}`)
                .setStyle(ButtonStyle.Secondary)
        )
    );
    await user.send({ embeds: [embed], components: [row] }).catch(() => {});
}

// Автоматический статус: ответ staff помечает тикет "ждём автора",
// ответ автора снимает эту пометку. Любая активность сбрасывает
// warnedAt, чтобы не автозакрыть тикет сразу после того, как в нём
// наконец что-то произошло.
async function recordActivity(threadId, authorIsOwner) {
    const now = Date.now();
    let updatedEntry = null;
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (!e || e.status === STATUS.RESOLVED) return;
        e.lastActivityAt = now;
        e.warnedAt = null;
        if (authorIsOwner) {
            if (e.status === STATUS.WAITING_ON_USER) e.status = STATUS.OPEN;
        } else {
            e.status = STATUS.WAITING_ON_USER;
        }
        updatedEntry = e;
    });
    return updatedEntry;
}

async function recordRating(threadId, rating) {
    let entry = null;
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (!e) return;
        e.rating = rating;
        e.ratedAt = Date.now();
        entry = e;
    });
    return entry;
}

module.exports = {
    STATUS,
    STATUS_LABELS,
    STATUS_COLORS,
    REASONS,
    CANNED_RESPONSES,
    isStaff,
    findOpenTicketByOwner,
    canCloseTicket,
    formatDuration,
    aggregateStats,
    findTicketsToEscalate,
    findTicketsToWarn,
    findTicketsToAutoClose,
    markEscalated,
    markWarned,
    buildPanelMessage,
    buildTicketControlRow,
    buildTicketEmbed,
    createTicket,
    updateTicketRootMessage,
    claimTicket,
    addTicketMember,
    createDiscussionVoiceChannel,
    getOrCreateDiscussionVoiceChannel,
    getOrCreateNotesThread,
    closeTicket,
    reopenTicket,
    sendRatingRequest,
    recordActivity,
    recordRating,
    postCannedResponse,
};
