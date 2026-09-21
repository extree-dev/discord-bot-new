const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { load } = require('./config');
const { log } = require('./logger');
const { COLORS, baseEmbed, formatBody, errorEmbed, infoEmbed } = require('../utils/embeds');
const leveling = require('../leveling');

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
    const config = await load();
    if (!config.verification.enabled || !config.verification.unverifiedRoleId) return;

    const role = member.guild.roles.cache.get(config.verification.unverifiedRoleId);
    if (!role) return;

    await member.roles.add(role, 'Верификация: ожидание подтверждения').catch(err => {
        console.error('verification: не удалось выдать роль новичку:', err.message);
    });
}

async function handleButton(interaction) {
    if (interaction.customId !== VERIFY_BUTTON_ID) return false;

    const config = await load();
    const guild = interaction.guild;
    const member = interaction.member;

    // "Уже верифицирован" проверяем по наличию именно verifiedRole, а не
    // по отсутствию unverifiedRole — это не одно и то же: если админ
    // вручную снял verifiedRole (не тронув unverifiedRole, которого у
    // участника вообще могло не быть — например, он зашёл до включения
    // верификации), у участника нет ни одной из двух ролей. Проверка по
    // "нет unverifiedRole → значит уже верифицирован" в этом случае
    // ошибочно блокировала повторную верификацию, не выдавая verifiedRole
    // обратно.
    const verifiedRole = config.verification.verifiedRoleId
        ? guild.roles.cache.get(config.verification.verifiedRoleId)
        : null;

    if (verifiedRole && member.roles.cache.has(verifiedRole.id)) {
        await interaction.reply({
            embeds: [infoEmbed('Ты уже верифицирован.', 'Уже верифицирован')],
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

    const config = await load();
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

    // Стартовая роль уровня активности ("Новичок") — сразу при верификации,
    // а не когда участник наберёт первые очки (у leveling/ очки растут
    // только от собственной активности, см. leveling/model.js), чтобы у
    // любого верифицированного участника с самого начала была хоть
    // какая-то роль уровня. Best-effort: если роль не настроена или её
    // не удалось выдать, верификацию это не должно ломать.
    const starterRoleId = await leveling.getLevelRoleId(guild.id, 0).catch(() => null);
    if (starterRoleId && !member.roles.cache.has(starterRoleId)) {
        await member.roles.add(starterRoleId, 'Верификация пройдена').catch(() => {});
    }

    const passedEmbed = baseEmbed(COLORS.success).setDescription(
        formatBody('Верификация пройдена', 'Добро пожаловать!')
    );
    await interaction.reply({ embeds: [passedEmbed], ephemeral: true });
    await log(
        guild,
        baseEmbed(COLORS.success)
            .setDescription(formatBody('Верификация пройдена'))
            .addFields({ name: 'Участник', value: `${member.user.tag} (${member.id})` })
    );
    return true;
}

function register(client) {
    client.on('guildMemberAdd', member => handleJoin(member).catch(err => console.error('verification:', err)));
}

module.exports = { register, handleButton, handleModalSubmit, VERIFY_BUTTON_ID };
