const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    AttachmentBuilder,
} = require('discord.js');
const { load, update } = require('./config');
const { errorEmbed } = require('../utils/embeds');

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

function buildPanelMessage(guild) {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
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

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Тикет #${number}`)
        .setDescription(
            `${member} открыл тикет.\nТема: **${reason.label}**\n\n` +
                'Опиши свою проблему подробно — команда поддержки подключится в ближайшее время.\n\n' +
                [
                    '`Взять в работу` — отмечает, что этим тикетом занимается конкретный человек из поддержки',
                    '`Добавить участника` — даёт доступ к тикету ещё одному пользователю (например, свидетелю)',
                    '`Закрыть` — завершает обращение; доступно автору тикета и поддержке. После закрытия переписка сохраняется в архив',
                ].join('\n')
        )
        .setTimestamp();

    await channel.send({ embeds: [embed], components: [buildTicketControlRow()] });
    return { channel };
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
                    new EmbedBuilder()
                        .setColor(0x5865f2)
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
                        )
                        .setTimestamp(),
                ],
                files: [transcript],
            })
            .catch(() => {});
    }

    // Удаление записи о тикете идёт через update(), а не через
    // "load-в-начале-функции + save()" — между началом closeTicket и
    // этой строкой были await'ы (fetch сообщений, отправка лога), за
    // которые кто-то другой мог успеть изменить tickets.json.
    await update(cfg => {
        delete cfg.tickets[channel.id];
    });

    await channel
        .send({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('Тикет закрывается через 5 секунд...')] })
        .catch(() => {});

    setTimeout(() => channel.delete('Тикет закрыт').catch(() => {}), 5000);
}

async function handleButton(interaction) {
    if (interaction.customId === 'ticket_open') {
        const config = await load();
        const existing = findTicketByOwner(config, interaction.user.id);
        if (existing) {
            await interaction.reply({
                embeds: [errorEmbed(`У тебя уже открыт тикет: <#${existing[0]}>`)],
                ephemeral: true,
            });
            return true;
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('ticket_reason_select')
            .setPlaceholder('Выбери тему обращения')
            .addOptions(REASONS.map(r => ({ label: r.label, value: r.value })));
        await interaction.reply({
            content: 'С чем нужна помощь?',
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true,
        });
        return true;
    }

    if (
        interaction.customId === 'ticket_claim' ||
        interaction.customId === 'ticket_adduser' ||
        interaction.customId === 'ticket_close'
    ) {
        const config = await load();
        const entry = config.tickets[interaction.channelId];
        if (!entry) {
            await interaction.reply({ embeds: [errorEmbed('Это не канал тикета.')], ephemeral: true });
            return true;
        }

        if (interaction.customId === 'ticket_claim') {
            if (!isStaff(config, interaction.member)) {
                await interaction.reply({
                    embeds: [errorEmbed('Только поддержка или модератор может взять тикет в работу.')],
                    ephemeral: true,
                });
                return true;
            }
            if (entry.claimedBy && entry.claimedBy !== interaction.user.id) {
                await interaction.reply({
                    embeds: [errorEmbed(`Тикет уже взят в работу <@${entry.claimedBy}>.`)],
                    ephemeral: true,
                });
                return true;
            }
            if (entry.claimedBy === interaction.user.id) {
                await interaction.reply({
                    embeds: [errorEmbed('Ты уже ведёшь этот тикет.')],
                    ephemeral: true,
                });
                return true;
            }

            // Захват тикета — атомарная проверка-и-запись: перечитываем
            // свежие данные внутри лока файла и проверяем claimedBy ещё
            // раз, на случай если кто-то другой забрал тикет за то время,
            // пока мы читали config в начале обработчика.
            const claim = await update(cfg => {
                const freshEntry = cfg.tickets[interaction.channelId];
                if (!freshEntry) return { status: 'gone' };
                if (freshEntry.claimedBy) return { status: 'already-claimed', claimedBy: freshEntry.claimedBy };
                freshEntry.claimedBy = interaction.user.id;
                return { status: 'claimed', supportRoleId: cfg.supportRoleId };
            });

            if (claim.status === 'gone') {
                await interaction.reply({ embeds: [errorEmbed('Это не канал тикета.')], ephemeral: true });
                return true;
            }
            if (claim.status === 'already-claimed') {
                await interaction.reply({
                    embeds: [
                        errorEmbed(
                            claim.claimedBy === interaction.user.id
                                ? 'Ты уже ведёшь этот тикет.'
                                : `Тикет уже взят в работу <@${claim.claimedBy}>.`
                        ),
                    ],
                    ephemeral: true,
                });
                return true;
            }

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

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x57f287)
                        .setDescription(
                            `<@${interaction.user.id}> взял тикет в работу. Остальная поддержка больше не видит этот канал.`
                        ),
                ],
            });
            return true;
        }

        if (interaction.customId === 'ticket_adduser') {
            if (!isStaff(config, interaction.member)) {
                await interaction.reply({
                    embeds: [errorEmbed('Только поддержка или модератор может добавлять участников.')],
                    ephemeral: true,
                });
                return true;
            }
            const select = new UserSelectMenuBuilder()
                .setCustomId('ticket_adduser_select')
                .setPlaceholder('Кого добавить в тикет?')
                .setMinValues(1)
                .setMaxValues(1);
            await interaction.reply({
                content: 'Выбери участника, чтобы дать ему доступ к тикету:',
                components: [new ActionRowBuilder().addComponents(select)],
                ephemeral: true,
            });
            return true;
        }

        if (interaction.customId === 'ticket_close') {
            const userId = interaction.user.id;
            const isOwner = entry.ownerId === userId;

            if (!entry.claimedBy) {
                if (!isOwner && !isStaff(config, interaction.member)) {
                    await interaction.reply({
                        embeds: [errorEmbed('Только автор тикета или поддержка может его закрыть.')],
                        ephemeral: true,
                    });
                    return true;
                }
            } else {
                const isClaimer = entry.claimedBy === userId;
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
                if (!isOwner && !isClaimer && !isAdmin) {
                    await interaction.reply({
                        embeds: [
                            errorEmbed(`Тикет ведёт <@${entry.claimedBy}>. Закрыть может только он или автор тикета.`),
                        ],
                        ephemeral: true,
                    });
                    return true;
                }
            }

            await interaction.deferUpdate();
            await closeTicket(interaction, interaction.channel, entry);
            return true;
        }
    }

    return false;
}

async function handleSelectMenu(interaction) {
    if (interaction.customId === 'ticket_reason_select') {
        const value = interaction.values[0];
        const reason = REASONS.find(r => r.value === value) ?? REASONS[REASONS.length - 1];
        const result = await createTicket(interaction, reason);
        if (result.error) {
            await interaction.update({ content: null, embeds: [errorEmbed(result.error)], components: [] });
            return true;
        }
        await interaction.update({
            content: null,
            embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Тикет создан: ${result.channel}`)],
            components: [],
        });
        return true;
    }

    if (interaction.customId === 'ticket_adduser_select') {
        const config = await load();
        const entry = config.tickets[interaction.channelId];
        if (!entry || !isStaff(config, interaction.member)) {
            await interaction.reply({
                embeds: [errorEmbed('Нет доступа к управлению этим тикетом.')],
                ephemeral: true,
            });
            return true;
        }
        const targetId = interaction.values[0];
        await interaction.channel.permissionOverwrites
            .edit(targetId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            })
            .catch(() => {});
        const user =
            interaction.guild.members.cache.get(targetId)?.user ?? interaction.client.users.cache.get(targetId);
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`${user ?? 'Участник'} добавлен в тикет.`)],
            ephemeral: true,
        });
        return true;
    }

    return false;
}

function register() {}

module.exports = { register, handleButton, handleSelectMenu, buildPanelMessage, isStaff, findTicketByOwner };
