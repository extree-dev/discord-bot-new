const { PermissionFlagsBits } = require('discord.js');
const { load } = require('./config');
const model = require('./model');
const { toMessage } = require('../utils/components');
const { errorEmbed } = require('../utils/embeds');

async function handleMessageCreate(message) {
    if (!message.guild || message.author.bot) return;
    const config = await load();
    if (!model.isModerated(config.moderatedChannelIds, message.channel.id)) return;
    if (!config.reviewChannelId) return;

    const reviewChannel =
        message.guild.channels.cache.get(config.reviewChannelId) ??
        (await message.guild.channels.fetch(config.reviewChannelId).catch(() => null));
    if (!reviewChannel) return;

    await model.submitForReview(message, reviewChannel);
}

// Право на решение — то же ModerateMembers, что и у большинства
// модераторских команд бота (не завязано на tickets/security.baseRoleIds
// специально — фича не зависит от других).
function canModerate(member) {
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers)
    );
}

const handleApproveButton = async interaction => {
    if (!canModerate(interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Одобрять публикации может только модерация.')],
            ephemeral: true,
        });
        return;
    }
    const pendingId = interaction.customId.slice(model.APPROVE_PREFIX.length);
    await interaction.deferUpdate();
    const result = await model.approvePost(interaction.client, pendingId);

    if (result.error === 'expired') {
        await interaction.message.edit(toMessage(model.buildOutcomeCard('expired', {}))).catch(() => {});
        return;
    }
    // channel-gone — заявка была валидной (не истекла), но исходный канал
    // с тех пор удалили: считаем решённой (нечего публиковать), просто
    // сообщаем об этом в самой карточке вместо "Одобрено".
    const kind = result.error === 'channel-gone' ? 'expired' : 'approved';
    await interaction.message
        .edit(
            toMessage(
                model.buildOutcomeCard(kind, { authorId: result.item.authorId, moderator: `${interaction.user}` })
            )
        )
        .catch(() => {});
};

const handleRejectButton = async interaction => {
    if (!canModerate(interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Отклонять публикации может только модерация.')],
            ephemeral: true,
        });
        return;
    }
    const pendingId = interaction.customId.slice(model.REJECT_PREFIX.length);
    await interaction.deferUpdate();
    const result = model.rejectPost(pendingId);

    const kind = result.error === 'expired' ? 'expired' : 'rejected';
    const authorId = result.item?.authorId;
    await interaction.message
        .edit(toMessage(model.buildOutcomeCard(kind, { authorId, moderator: `${interaction.user}` })))
        .catch(() => {});
};

async function handleButton(interaction) {
    if (interaction.customId.startsWith(model.APPROVE_PREFIX)) {
        await handleApproveButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(model.REJECT_PREFIX)) {
        await handleRejectButton(interaction);
        return true;
    }
    return false;
}

function register(client) {
    client.on('messageCreate', msg => {
        handleMessageCreate(msg).catch(err => console.error('modqueue messageCreate:', err));
    });
}

module.exports = { register, handleButton, handleMessageCreate };
