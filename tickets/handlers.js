// Роутинг Discord-взаимодействий тикетов: сопоставляет customId с
// обработчиком через карту (вместо цепочки if/else) и делегирует всю
// доменную работу в tickets/model.js — здесь только разбор
// interaction'а и построение ответных сообщений.
const { ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');
const { load } = require('./config');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const model = require('./model');

async function handleOpenButton(interaction) {
    const config = await load();
    const existing = model.findTicketByOwner(config, interaction.user.id);
    if (existing) {
        await interaction.reply({
            embeds: [errorEmbed(`У тебя уже открыт тикет: <#${existing[0]}>`)],
            ephemeral: true,
        });
        return;
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_reason_select')
        .setPlaceholder('Выбери тему обращения')
        .addOptions(model.REASONS.map(r => ({ label: r.label, value: r.value })));
    await interaction.reply({
        content: 'С чем нужна помощь?',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
    });
}

// Общая для claim/adduser/close проверка "это вообще канал тикета?" —
// раньше жила один раз перед веткой if в handleButton, теперь оборачивает
// каждый из трёх обработчиков, чтобы каждый оставался самостоятельным.
function withTicketEntry(handler) {
    return async interaction => {
        const config = await load();
        const entry = config.tickets[interaction.channelId];
        if (!entry) {
            await interaction.reply({ embeds: [errorEmbed('Это не канал тикета.')], ephemeral: true });
            return;
        }
        await handler(interaction, config, entry);
    };
}

const handleClaimButton = withTicketEntry(async (interaction, config, entry) => {
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может взять тикет в работу.')],
            ephemeral: true,
        });
        return;
    }
    if (entry.claimedBy && entry.claimedBy !== interaction.user.id) {
        await interaction.reply({
            embeds: [errorEmbed(`Тикет уже взят в работу <@${entry.claimedBy}>.`)],
            ephemeral: true,
        });
        return;
    }
    if (entry.claimedBy === interaction.user.id) {
        await interaction.reply({ embeds: [errorEmbed('Ты уже ведёшь этот тикет.')], ephemeral: true });
        return;
    }

    const claim = await model.claimTicket(interaction);

    if (claim.status === 'gone') {
        await interaction.reply({ embeds: [errorEmbed('Это не канал тикета.')], ephemeral: true });
        return;
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
        return;
    }

    await interaction.reply({
        embeds: [
            successEmbed(
                `<@${interaction.user.id}> взял тикет в работу. Остальная поддержка больше не видит этот канал.`,
                '🙋 Тикет взят в работу'
            ),
        ],
    });
});

const handleAddUserButton = withTicketEntry(async (interaction, config) => {
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может добавлять участников.')],
            ephemeral: true,
        });
        return;
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
});

const handleCloseButton = withTicketEntry(async (interaction, config, entry) => {
    if (!model.canCloseTicket(config, entry, interaction.member)) {
        const reason = entry.claimedBy
            ? `Тикет ведёт <@${entry.claimedBy}>. Закрыть может только он или автор тикета.`
            : 'Только автор тикета или поддержка может его закрыть.';
        await interaction.reply({ embeds: [errorEmbed(reason)], ephemeral: true });
        return;
    }

    await interaction.deferUpdate();
    await model.closeTicket(interaction, interaction.channel, entry);
});

const BUTTON_HANDLERS = {
    ticket_open: handleOpenButton,
    ticket_claim: handleClaimButton,
    ticket_adduser: handleAddUserButton,
    ticket_close: handleCloseButton,
};

async function handleButton(interaction) {
    const handler = BUTTON_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
}

async function handleReasonSelect(interaction) {
    const value = interaction.values[0];
    const reason = model.REASONS.find(r => r.value === value) ?? model.REASONS[model.REASONS.length - 1];
    const result = await model.createTicket(interaction, reason);
    if (result.error) {
        await interaction.update({ content: null, embeds: [errorEmbed(result.error)], components: [] });
        return;
    }
    await interaction.update({
        content: null,
        embeds: [successEmbed(`Тикет создан: ${result.channel}`, '🎫 Тикет создан')],
        components: [],
    });
}

async function handleAddUserSelect(interaction) {
    const config = await load();
    const entry = config.tickets[interaction.channelId];
    if (!entry || !model.isStaff(config, interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Нет доступа к управлению этим тикетом.')], ephemeral: true });
        return;
    }
    const targetId = interaction.values[0];
    const user = await model.addTicketMember(interaction, targetId);
    await interaction.reply({
        embeds: [successEmbed(`${user ?? 'Участник'} добавлен в тикет.`, '➕ Участник добавлен')],
        ephemeral: true,
    });
}

const SELECT_MENU_HANDLERS = {
    ticket_reason_select: handleReasonSelect,
    ticket_adduser_select: handleAddUserSelect,
};

async function handleSelectMenu(interaction) {
    const handler = SELECT_MENU_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
}

function register() {}

module.exports = { register, handleButton, handleSelectMenu };
