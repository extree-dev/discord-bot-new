const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require('discord.js');
const { load } = require('./config');
const { log } = require('./logger');
const { COLORS, baseEmbed, formatBody, errorEmbed, infoEmbed, warningEmbed } = require('../utils/embeds');
const leveling = require('../leveling');
const { generateCode, renderCaptcha, CODE_LENGTH } = require('./captchaImage');

const VERIFY_BUTTON_ID = 'security_verify';
const VERIFY_ANSWER_BUTTON_ID = 'security_verify_answer';
const VERIFY_MODAL_ID = 'security_verify_modal';
const VERIFY_ANSWER_INPUT_ID = 'security_verify_answer_input';
// Заметно больше, чем раньше (было 2 мин на решение самой капчи) —
// теперь в это же окно укладывается ещё и лишний клик по кнопке "Ввести
// код" между показом картинки и открытием модалки (см. handleButton).
const CHALLENGE_TTL_MS = 3 * 60 * 1000;
// Сколько неверных ответов подряд считаются одной "сессией" неудач —
// после паузы дольше этого окна счётчик начинается заново, а не
// продолжает копиться месяцами.
const FAIL_WINDOW_MS = 5 * 60 * 1000;

// userId -> { code, expiresAt }
const pendingChallenges = new Map();
// userId -> { count, windowStart, lockedUntil? }
const failedAttempts = new Map();

function cleanupExpiredChallenges() {
    const now = Date.now();
    for (const [userId, challenge] of pendingChallenges) {
        if (now > challenge.expiresAt) pendingChallenges.delete(userId);
    }
}

function minutesLeft(untilTs) {
    return Math.max(1, Math.ceil((untilTs - Date.now()) / 60000));
}

function isLockedOut(userId) {
    const entry = failedAttempts.get(userId);
    return Boolean(entry?.lockedUntil && Date.now() < entry.lockedUntil);
}

function clearFailures(userId) {
    failedAttempts.delete(userId);
}

// Три неверных кода подряд — уже не похоже на человека, ошибившегося при
// вводе (капча — всего 5 цифр с картинки, а не сложная форма): скорее
// перебор скриптом. Блокируем новые попытки на время и сразу зовём
// модерацию посмотреть, кто это — тем более что дальше он всё равно
// упрётся в новую капчу при следующей попытке.
async function registerFailure(guild, member, config) {
    const now = Date.now();
    const entry = failedAttempts.get(member.id) ?? { count: 0, windowStart: now };
    if (now - entry.windowStart > FAIL_WINDOW_MS) {
        entry.count = 0;
        entry.windowStart = now;
    }
    entry.count += 1;

    if (entry.count >= config.verification.maxCaptchaAttempts) {
        entry.lockedUntil = now + config.verification.captchaLockoutMs;
        failedAttempts.set(member.id, entry);
        await log(
            guild,
            warningEmbed(
                `${entry.count} неверных ответа на капчу подряд — новые попытки заблокированы на ${Math.round(config.verification.captchaLockoutMs / 60000)} мин.`,
                'Подозрительная верификация'
            ).addFields({ name: 'Участник', value: `${member.user.tag} (${member.id})` })
        );
        return entry;
    }

    failedAttempts.set(member.id, entry);
    return entry;
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

// Шаг 1: кнопка "Пройти верификацию" — проверяет, что участник ещё не
// верифицирован, что аккаунт не слишком новый и что он не заблокирован
// за подозрительные попытки, затем показывает картинку-капчу с кнопкой
// "Ввести код" (саму капчу картинкой в модалку не вставить — Discord
// поддерживает в модалках только текстовые поля, см. captchaImage.js).
async function startVerification(interaction) {
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

    // Возраст аккаунта — самый дешёвый фильтр от рейд-ботов: массовый
    // рейд почти всегда идёт с аккаунтов, созданных за минуты/часы до
    // захода. Не блокирует навсегда: как только аккаунт "дозреет" до
    // порога, кнопка сама заработает — ручное вмешательство модерации
    // нужно, только если человек хочет попасть раньше срока.
    const accountAgeMs = Date.now() - interaction.user.createdTimestamp;
    if (accountAgeMs < config.verification.minAccountAgeMs) {
        const remainingHours = Math.ceil((config.verification.minAccountAgeMs - accountAgeMs) / 3600000);
        await interaction.reply({
            embeds: [
                warningEmbed(
                    `Аккаунт Discord слишком новый для автоматической верификации — подожди ещё примерно ${remainingHours} ч. Если это ошибка, напиши модерации напрямую.`,
                    'Подожди немного'
                ),
            ],
            ephemeral: true,
        });
        await log(
            guild,
            warningEmbed(
                `Аккаунт создан ${Math.round(accountAgeMs / 3600000)} ч. назад (порог: ${Math.round(config.verification.minAccountAgeMs / 3600000)} ч).`,
                'Верификация: слишком новый аккаунт'
            ).addFields({ name: 'Участник', value: `${member.user.tag} (${member.id})` })
        );
        return true;
    }

    if (isLockedOut(interaction.user.id)) {
        const entry = failedAttempts.get(interaction.user.id);
        await interaction.reply({
            embeds: [
                errorEmbed(
                    `Слишком много неверных попыток — подожди ещё ${minutesLeft(entry.lockedUntil)} мин. и нажми кнопку снова.`
                ),
            ],
            ephemeral: true,
        });
        return true;
    }

    cleanupExpiredChallenges();
    const code = generateCode();
    pendingChallenges.set(interaction.user.id, { code, expiresAt: Date.now() + CHALLENGE_TTL_MS });

    const attachment = new AttachmentBuilder(renderCaptcha(code), { name: 'captcha.png' });
    const enterCodeButton = new ButtonBuilder()
        .setCustomId(VERIFY_ANSWER_BUTTON_ID)
        .setLabel('Ввести код')
        .setStyle(ButtonStyle.Secondary);

    await interaction.reply({
        embeds: [
            baseEmbed(COLORS.primary)
                .setDescription(
                    formatBody('Подтверди, что ты не бот', 'Введи 5 цифр с картинки ниже — код действует 3 минуты.')
                )
                .setImage('attachment://captcha.png'),
        ],
        files: [attachment],
        components: [new ActionRowBuilder().addComponents(enterCodeButton)],
        ephemeral: true,
    });
    return true;
}

// Шаг 2: кнопка "Ввести код" под картинкой — открывает модалку с одним
// пустым текстовым полем (в отличие от старой капчи, ответ нигде не
// написан текстом, его видно только на картинке).
async function promptAnswer(interaction) {
    cleanupExpiredChallenges();
    const challenge = pendingChallenges.get(interaction.user.id);
    if (!challenge || Date.now() > challenge.expiresAt) {
        await interaction.reply({
            embeds: [errorEmbed('Код устарел. Нажми кнопку «Пройти верификацию» ещё раз.')],
            ephemeral: true,
        });
        return true;
    }

    const modal = new ModalBuilder().setCustomId(VERIFY_MODAL_ID).setTitle('Код с картинки');
    const input = new TextInputBuilder()
        .setCustomId(VERIFY_ANSWER_INPUT_ID)
        .setLabel('Введи код с картинки')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('12345')
        .setMinLength(CODE_LENGTH)
        .setMaxLength(CODE_LENGTH)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
}

async function handleButton(interaction) {
    if (interaction.customId === VERIFY_BUTTON_ID) return startVerification(interaction);
    if (interaction.customId === VERIFY_ANSWER_BUTTON_ID) return promptAnswer(interaction);
    return false;
}

async function handleModalSubmit(interaction) {
    if (interaction.customId !== VERIFY_MODAL_ID) return false;

    const config = await load();
    const guild = interaction.guild;
    const member = interaction.member;

    // Код одноразовый — удаляем сразу при чтении, независимо от того,
    // верный он или нет: повторный сабмит того же кода не должен
    // проходить, а на новую попытку участник всё равно получит другую
    // картинку с шага 1.
    const challenge = pendingChallenges.get(interaction.user.id);
    pendingChallenges.delete(interaction.user.id);

    if (!challenge || Date.now() > challenge.expiresAt) {
        await interaction.reply({
            embeds: [errorEmbed('Время на ответ истекло. Нажми кнопку «Пройти верификацию» ещё раз.')],
            ephemeral: true,
        });
        return true;
    }

    const submitted = interaction.fields.getTextInputValue(VERIFY_ANSWER_INPUT_ID).trim();
    if (submitted !== challenge.code) {
        const entry = await registerFailure(guild, member, config);
        const message = entry.lockedUntil
            ? `Неверный код. Слишком много неудачных попыток — новые попытки заблокированы на ${Math.round(config.verification.captchaLockoutMs / 60000)} мин.`
            : `Неверный код. Осталось попыток: ${Math.max(0, config.verification.maxCaptchaAttempts - entry.count)}. Нажми «Пройти верификацию» ещё раз.`;
        await interaction.reply({ embeds: [errorEmbed(message)], ephemeral: true });
        return true;
    }

    clearFailures(interaction.user.id);

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
