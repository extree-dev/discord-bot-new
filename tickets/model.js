// Доменный слой тикетов: правила (кто staff, чей это тикет), создание и
// закрытие тикета, построение embed/кнопок. Никакого роутинга по
// customId здесь нет — этим занимается tickets/handlers.js.
const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require('discord.js');
const { load, update } = require('./config');
const { COLORS, baseEmbed } = require('../utils/embeds');

const REASONS = [
    { value: 'general', label: 'Общий вопрос' },
    { value: 'bug', label: 'Баг / техническая проблема' },
    { value: 'report', label: 'Жалоба на игрока' },
    { value: 'payment', label: 'Донат / платежи' },
    { value: 'other', label: 'Другое' },
];

function isStaff(config, member) {
    if (config.supportRoleId && member.roles.cache.has(config.supportRoleId)) return true;
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers)
    );
}

function findTicketByOwner(config, userId) {
    return Object.entries(config.tickets).find(([, t]) => t.ownerId === userId);
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

function buildPanelMessage(guild) {
    const embed = baseEmbed(COLORS.primary)
        .setTitle('Поддержка сервера')
        .setDescription(
            'Нужна помощь? Нажми кнопку ниже и выбери тему — мы откроем приватный канал с командой поддержки, ' +
                'который увидишь только ты и staff.\n\n' +
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
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Взять в работу').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('ticket_adduser')
            .setLabel('Добавить участника')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Закрыть').setStyle(ButtonStyle.Danger)
    );
}

async function createTicket(interaction, reason) {
    const guild = interaction.guild;
    const member = interaction.member;

    // Проверка "тикет уже есть" и резервирование номера должны быть
    // одной атомарной операцией — иначе два клика (или два разных
    // пользователя, задевших getCounter почти одновременно) могут
    // получить один и тот же номер, а поздняя save() затрёт запись
    // о тикете, созданном первым вызовом. Лок держим только на это
    // быстрое чтение+инкремент, не на медленный API-вызов создания канала.
    const reservation = await update(config => {
        const existing = findTicketByOwner(config, member.id);
        if (existing) {
            return { error: `У тебя уже открыт тикет: <#${existing[0]}>` };
        }
        config.counter += 1;
        return { number: config.counter, categoryId: config.categoryId, supportRoleId: config.supportRoleId };
    });

    if (reservation.error) return { error: reservation.error };

    const { number, categoryId, supportRoleId } = reservation;
    const category = categoryId ? guild.channels.cache.get(categoryId) : null;
    const supportRole = supportRoleId ? guild.roles.cache.get(supportRoleId) : null;

    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: member.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        },
    ];
    if (supportRole) {
        overwrites.push({
            id: supportRole.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        });
    }

    const channel = await guild.channels.create({
        name: `тикет-${number}-${member.user.username}`.slice(0, 95).toLowerCase(),
        type: ChannelType.GuildText,
        parent: category?.id ?? null,
        permissionOverwrites: overwrites,
        topic: `Тикет #${number} · ${member.user.tag} · ${reason.label}`,
    });

    await update(config => {
        config.tickets[channel.id] = {
            number,
            ownerId: member.id,
            reason: reason.label,
            claimedBy: null,
            createdAt: Date.now(),
        };
    });

    const embed = baseEmbed(COLORS.primary)
        .setTitle(`Тикет #${number}`)
        .setDescription(
            `${member} открыл тикет.\nТема: **${reason.label}**\n\n` +
                'Опиши свою проблему подробно — команда поддержки подключится в ближайшее время.\n\n' +
                [
                    '`Взять в работу` — отмечает, что этим тикетом занимается конкретный человек из поддержки',
                    '`Добавить участника` — даёт доступ к тикету ещё одному пользователю (например, свидетелю)',
                    '`Закрыть` — завершает обращение; доступно автору тикета и поддержке. После закрытия переписка сохраняется в архив',
                ].join('\n')
        );

    await channel.send({ embeds: [embed], components: [buildTicketControlRow()] });
    return { channel };
}

// Атомарный захват тикета: перечитывает свежие данные внутри лока и
// проверяет claimedBy ещё раз (вдруг кто-то другой забрал тикет за то
// время, пока вызывающий код читал config до этого) и сразу применяет
// side-эффект (снятие доступа поддержки, выдача доступа заявителю) —
// права на канал такая же часть "захвата", как и запись в БД.
async function claimTicket(interaction) {
    const claim = await update(cfg => {
        const entry = cfg.tickets[interaction.channelId];
        if (!entry) return { status: 'gone' };
        if (entry.claimedBy) return { status: 'already-claimed', claimedBy: entry.claimedBy };
        entry.claimedBy = interaction.user.id;
        return { status: 'claimed', supportRoleId: cfg.supportRoleId };
    });

    if (claim.status !== 'claimed') return claim;

    if (claim.supportRoleId) {
        await interaction.channel.permissionOverwrites.delete(claim.supportRoleId).catch(() => {});
    }
    await interaction.channel.permissionOverwrites
        .edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ManageMessages: true,
            ReadMessageHistory: true,
        })
        .catch(() => {});

    return claim;
}

// Даёт участнику доступ к каналу тикета и возвращает его User (для
// сообщения-подтверждения) — сама выдача прав такая же часть домена
// "добавить участника в тикет", как и то, кому конкретно это разрешено.
async function addTicketMember(interaction, targetId) {
    await interaction.channel.permissionOverwrites
        .edit(targetId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true })
        .catch(() => {});
    return interaction.guild.members.cache.get(targetId)?.user ?? interaction.client.users.cache.get(targetId) ?? null;
}

async function closeTicket(interaction, channel, entry) {
    const config = await load();

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const sorted = messages ? [...messages.values()].reverse() : [];
    const lines = sorted.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || '(вложение/embed)'}`);
    const transcriptText = lines.length ? lines.join('\n') : 'Сообщений нет.';
    const transcript = new AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), {
        name: `ticket-${entry.number}.txt`,
    });

    const logChannel = config.logChannelId ? interaction.guild.channels.cache.get(config.logChannelId) : null;
    if (logChannel) {
        const owner = await interaction.guild.members.fetch(entry.ownerId).catch(() => null);
        await logChannel
            .send({
                embeds: [
                    baseEmbed(COLORS.primary)
                        .setTitle(`Тикет #${entry.number} закрыт`)
                        .addFields(
                            { name: 'Открыл', value: owner ? `${owner}` : entry.ownerId, inline: true },
                            { name: 'Тема', value: entry.reason, inline: true },
                            { name: 'Закрыл', value: `${interaction.user}`, inline: true },
                            {
                                name: 'Взял в работу',
                                value: entry.claimedBy ? `<@${entry.claimedBy}>` : 'никто',
                                inline: true,
                            }
                        ),
                ],
                files: [transcript],
            })
            .catch(() => {});
    }

    // Удаление записи о тикете идёт через update(), а не через
    // "load-в-начале-функции + save()" — между началом closeTicket и
    // этой строкой были await'ы (fetch сообщений, отправка лога), за
    // которые кто-то другой мог успеть изменить данные тикетов.
    await update(cfg => {
        delete cfg.tickets[channel.id];
    });

    await channel
        .send({
            embeds: [
                baseEmbed(COLORS.danger).setTitle('Тикет закрывается').setDescription('Закрывается через 5 секунд...'),
            ],
        })
        .catch(() => {});

    setTimeout(() => channel.delete('Тикет закрыт').catch(() => {}), 5000);
}

module.exports = {
    REASONS,
    isStaff,
    findTicketByOwner,
    canCloseTicket,
    buildPanelMessage,
    buildTicketControlRow,
    createTicket,
    claimTicket,
    addTicketMember,
    closeTicket,
};
