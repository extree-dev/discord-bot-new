const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { load } = require('./config');
const { log } = require('./logger');
const { errorEmbed } = require('../utils/embeds');

const VERIFY_BUTTON_ID = 'security_verify';
const VERIFY_MODAL_ID = 'security_verify_modal';
const VERIFY_ANSWER_ID = 'security_verify_answer';
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

const pendingChallenges = new Map();

function cleanupExpired() {
    const now = Date.now();
    for (const [userId, challenge] of pendingChallenges) {
        if (now > challenge.expiresAt) pendingChallenges.delete(userId);
    }
}

async function handleJoin(member) {
    if (member.user.bot) return;
    const config = load();
    if (!config.verification.enabled || !config.verification.unverifiedRoleId) return;

    const role = member.guild.roles.cache.get(config.verification.unverifiedRoleId);
    if (!role) return;

    await member.roles.add(role, 'Верификация: ожидание подтверждения').catch(err => {
        console.error('verification: не удалось выдать роль новичку:', err.message);
    });
}

async function handleButton(interaction) {
    if (interaction.customId !== VERIFY_BUTTON_ID) return false;

    const config = load();
    const guild = interaction.guild;
    const member = interaction.member;

    const unverifiedRole = config.verification.unverifiedRoleId
        ? guild.roles.cache.get(config.verification.unverifiedRoleId)
        : null;

    if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
        await interaction.reply({
            embeds: [errorEmbed('Ты уже верифицирован.').setColor(0x5865f2).setTitle('Уже верифицирован')],
            ephemeral: true,
        });
        return true;
    }

    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;

    cleanupExpired();
    pendingChallenges.set(interaction.user.id, { answer: a + b, expiresAt: Date.now() + CHALLENGE_TTL_MS });

    const modal = new ModalBuilder().setCustomId(VERIFY_MODAL_ID).setTitle('Подтверди, что ты не бот');
    const input = new TextInputBuilder()
        .setCustomId(VERIFY_ANSWER_ID)
        .setLabel(`Сколько будет ${a} + ${b}?`)
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(3)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
}

async function handleModalSubmit(interaction) {
    if (interaction.customId !== VERIFY_MODAL_ID) return false;

    const config = load();
    const guild = interaction.guild;
    const member = interaction.member;

    const challenge = pendingChallenges.get(interaction.user.id);
    pendingChallenges.delete(interaction.user.id);

    if (!challenge || Date.now() > challenge.expiresAt) {
        await interaction.reply({
            embeds: [errorEmbed('Время на ответ истекло. Нажми кнопку «Пройти верификацию» ещё раз.')],
            ephemeral: true,
        });
        return true;
    }

    const submitted = interaction.fields.getTextInputValue(VERIFY_ANSWER_ID).trim();
    if (Number(submitted) !== challenge.answer) {
        await interaction.reply({
            embeds: [errorEmbed('Неверный ответ. Нажми кнопку «Пройти верификацию» ещё раз и попробуй снова.')],
            ephemeral: true,
        });
        return true;
    }

    const unverifiedRole = config.verification.unverifiedRoleId
        ? guild.roles.cache.get(config.verification.unverifiedRoleId)
        : null;
    const verifiedRole = config.verification.verifiedRoleId
        ? guild.roles.cache.get(config.verification.verifiedRoleId)
        : null;

    try {
        if (unverifiedRole) await member.roles.remove(unverifiedRole, 'Верификация пройдена');
        if (verifiedRole) await member.roles.add(verifiedRole, 'Верификация пройдена');
    } catch (err) {
        console.error('verification: не удалось выдать роли:', err.message);
        await interaction.reply({
            embeds: [errorEmbed('Не получилось выдать роль автоматически, обратись к администратору.')],
            ephemeral: true,
        });
        return true;
    }

    const successEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Верификация пройдена')
        .setDescription('Добро пожаловать!');
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    await log(
        guild,
        new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('Верификация пройдена')
            .addFields({ name: 'Участник', value: `${member.user.tag} (${member.id})` })
            .setTimestamp()
    );
    return true;
}

function register(client) {
    client.on('guildMemberAdd', member => handleJoin(member).catch(err => console.error('verification:', err)));
}

module.exports = { register, handleButton, handleModalSubmit, VERIFY_BUTTON_ID };
