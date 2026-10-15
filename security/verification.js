const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { load } = require('./config');
const { log } = require('./logger');
const { COLORS, baseEmbed, formatBody, errorEmbed, infoEmbed, warningEmbed } = require('../utils/embeds');
const leveling = require('../leveling');
const { generateCode, generateDecoys, renderCaptcha } = require('./captchaImage');
const { generateEmailCode, sendVerificationCode } = require('../utils/email');
const emailCodes = require('./emailCodes');

const VERIFY_BUTTON_ID = 'security_verify';
// customId кнопок-вариантов — сам кандидат-код кодируется в нём же
// (`${VERIFY_PICK_PREFIX}:${candidate}`), отдельно challenge-код нигде не
// хранится: сервер просто сверяет то, что пришло в customId нажатой
// кнопки, с кодом в pendingChallenges на момент клика.
const VERIFY_PICK_PREFIX = 'security_verify_pick';
// customId кнопок выбора пола — пол кодируется в самом customId
// ('male'/'female'). Выбор делается ДО капчи (см. startVerification) и
// хранится в pendingGenderChoice до её успешного прохождения — реальная
// роль выдаётся только вместе с остальными ролями в handlePick.
const GENDER_PICK_PREFIX = 'security_verify_gender';
// Модалки email-верификации (method === 'email')
const VERIFY_EMAIL_MODAL_ID = 'security_verify_email_modal';
const VERIFY_CODE_MODAL_ID = 'security_verify_code_modal';
const VERIFY_ENTER_CODE_BUTTON_ID = 'security_verify_enter_code';
const EMAIL_INPUT_ID = 'email_input';
const CODE_INPUT_ID = 'code_input';
// Кастомные эмодзи сервера (загружены администратором вручную) — кнопки
// выбора пола показывают только их, без подписи текстом.
const GENDER_MALE_EMOJI_ID = '1555576296686231582';
const GENDER_FEMALE_EMOJI_ID = '1555576559102857277';
// Столько кнопок-вариантов показываем под картинкой (1 верный + остальные
// похожие неверные) — Discord ограничивает ряд кнопок пятью, ровно влезает
// без переноса на второй ряд.
const CANDIDATES_COUNT = 5;
const CHALLENGE_TTL_MS = 3 * 60 * 1000;
// Сколько неверных ответов подряд считаются одной "сессией" неудач —
// после паузы дольше этого окна счётчик начинается заново, а не
// продолжает копиться месяцами.
const FAIL_WINDOW_MS = 5 * 60 * 1000;

// userId -> { code, expiresAt }
const pendingChallenges = new Map();
// userId -> { gender: 'male'|'female', expiresAt } — выбор пола, сделанный
// до капчи; дожидается её успешного прохождения в handlePick, где и
// применяется реальная роль.
const pendingGenderChoice = new Map();
// userId -> { count, windowStart, lockedUntil? }
const failedAttempts = new Map();

function cleanupExpiredChallenges() {
    const now = Date.now();
    for (const [userId, challenge] of pendingChallenges) {
        if (now > challenge.expiresAt) pendingChallenges.delete(userId);
    }
}

function cleanupExpiredGenderChoices() {
    const now = Date.now();
    for (const [userId, choice] of pendingGenderChoice) {
        if (now > choice.expiresAt) pendingGenderChoice.delete(userId);
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

function shuffled(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Три неверных клика подряд — уже не похоже на человека, ошибившегося при
// выборе (капча — просто выбор одной кнопки из пяти, а не сложная форма):
// скорее перебор скриптом. Блокируем новые попытки на время и сразу зовём
// модерацию посмотреть, кто это — тем более что дальше он всё равно
// упрётся в новую капчу при следующей попытке. Используется и для
// email-метода: неверный код письма — та же самая неудачная попытка.
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
                `${entry.count} неверных ответа на проверку подряд — новые попытки заблокированы на ${Math.round(config.verification.captchaLockoutMs / 60000)} мин.`,
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

// Показывает картинку-капчу и ряд из CANDIDATES_COUNT кнопок-вариантов под
// ней (см. captchaImage.js). mode === 'update' — правим на месте сообщение
// с кнопками выбора пола (после handleGenderPick), mode === 'reply' —
// обычный новый ответ (когда гендерные роли не настроены и капча — первый
// и единственный шаг).
async function presentCaptcha(interaction, mode) {
    cleanupExpiredChallenges();
    const code = generateCode();
    pendingChallenges.set(interaction.user.id, { code, expiresAt: Date.now() + CHALLENGE_TTL_MS });

    const candidates = shuffled([code, ...generateDecoys(code, CANDIDATES_COUNT - 1)]);
    const attachment = new AttachmentBuilder(renderCaptcha(code), { name: 'captcha.png' });
    const row = new ActionRowBuilder().addComponents(
        ...candidates.map(candidate =>
            new ButtonBuilder()
                .setCustomId(`${VERIFY_PICK_PREFIX}:${candidate}`)
                .setLabel(candidate)
                .setStyle(ButtonStyle.Secondary)
        )
    );

    const payload = {
        embeds: [
            baseEmbed(COLORS.primary)
                .setDescription(
                    formatBody(
                        'Подтверди, что ты не бот',
                        'Выбери код с картинки среди кнопок ниже — код действует 3 минуты.'
                    )
                )
                .setImage('attachment://captcha.png'),
        ],
        files: [attachment],
        components: [row],
    };

    if (mode === 'update') {
        await interaction.update(payload);
    } else {
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
}

// Модалка для ввода email (method === 'email').
function buildEmailModal() {
    const input = new TextInputBuilder()
        .setCustomId(EMAIL_INPUT_ID)
        .setLabel('Введите вашу почту')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('example@mail.com')
        .setRequired(true)
        .setMaxLength(100);

    return new ModalBuilder()
        .setCustomId(VERIFY_EMAIL_MODAL_ID)
        .setTitle('Привязка почты')
        .addComponents(new ActionRowBuilder().addComponents(input));
}

// Модалка для ввода кода из письма.
function buildCodeModal() {
    const input = new TextInputBuilder()
        .setCustomId(CODE_INPUT_ID)
        .setLabel('Код из письма')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('6 цифр')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(6);

    return new ModalBuilder()
        .setCustomId(VERIFY_CODE_MODAL_ID)
        .setTitle('Введите код')
        .addComponents(new ActionRowBuilder().addComponents(input));
}

// Шаг 1: кнопка "Пройти верификацию" — проверяет, что участник ещё не
// верифицирован, что аккаунт не слишком новый и что он не заблокирован за
// подозрительные попытки. Если на сервере настроены обе гендерные роли —
// первым шагом показывает выбор пола (handleGenderPick продолжит проверкой),
// иначе сразу переходит к выбранному методу (email-модалка или капча).
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
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    // Модуль выключен (/security-status, панель администратора) — раньше
    // это никак не проверялось здесь, только в handleJoin (не выдаёт
    // unverifiedRole новым участникам), из-за чего кнопка "Пройти
    // верификацию" продолжала работать целиком и выдавать verifiedRole,
    // даже когда админ явно отключил модуль.
    if (!config.verification.enabled) {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    'Верификация сейчас временно отключена администрацией. Обратись к администрации, чтобы получить доступ.',
                    'Верификация недоступна'
                ),
            ],
            flags: MessageFlags.Ephemeral,
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
            flags: MessageFlags.Ephemeral,
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
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    if (config.verification.genderMaleRoleId && config.verification.genderFemaleRoleId) {
        const genderRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${GENDER_PICK_PREFIX}:male`)
                .setEmoji({ id: GENDER_MALE_EMOJI_ID })
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`${GENDER_PICK_PREFIX}:female`)
                .setEmoji({ id: GENDER_FEMALE_EMOJI_ID })
                .setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({
            embeds: [
                baseEmbed(COLORS.primary).setDescription(
                    formatBody(
                        'Выбери свой пол',
                        'Роль будет выдана после прохождения проверки ниже. Сменить выбор позже можно через администрацию.'
                    )
                ),
            ],
            components: [genderRow],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    await startChallenge(interaction, config, 'reply');
    return true;
}

// Показывает первый шаг проверки в зависимости от выбранного метода.
// mode === 'update' — правим на месте сообщение с кнопками выбора пола
// (после handleGenderPick), mode === 'reply' — обычный новый ответ.
async function startChallenge(interaction, config, mode) {
    if (config.verification.method === 'email') {
        await interaction.showModal(buildEmailModal());
        return;
    }
    await presentCaptcha(interaction, mode);
}

// Шаг 2 (капча): клик по одной из кнопок-вариантов под картинкой —
// сравнивает код, зашитый в customId нажатой кнопки, с challenge.code,
// выданным на шаге 1 (см. VERIFY_PICK_PREFIX). Отдельного окна ввода не
// открывает — весь ответ — один клик.
async function handlePick(interaction) {
    const config = await load();
    const guild = interaction.guild;
    const member = interaction.member;

    // Челлендж одноразовый — удаляем сразу при чтении, независимо от
    // того, верный вариант выбран или нет: повторный клик по старому
    // сообщению не должен проходить, а на новую попытку участник всё
    // равно получит другую картинку с шага 1.
    cleanupExpiredChallenges();
    const challenge = pendingChallenges.get(interaction.user.id);
    pendingChallenges.delete(interaction.user.id);

    // Та же проверка, что в startVerification() — на случай, если админ
    // выключил модуль уже после того, как участник получил картинку с
    // капчей (challenge создаётся до этой проверки на шаге 1), пока он
    // выбирает вариант.
    if (!config.verification.enabled) {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    'Верификация сейчас временно отключена администрацией. Обратись к администрации, чтобы получить доступ.',
                    'Верификация недоступна'
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    if (!challenge || Date.now() > challenge.expiresAt) {
        await interaction.reply({
            embeds: [errorEmbed('Код устарел. Нажми кнопку «Пройти верификацию» ещё раз.')],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    const picked = interaction.customId.slice(`${VERIFY_PICK_PREFIX}:`.length);
    if (picked !== challenge.code) {
        const entry = await registerFailure(guild, member, config);
        const message = entry.lockedUntil
            ? `Неверный код. Слишком много неудачных попыток — новые попытки заблокированы на ${Math.round(config.verification.captchaLockoutMs / 60000)} мин.`
            : `Неверный код. Осталось попыток: ${Math.max(0, config.verification.maxCaptchaAttempts - entry.count)}. Нажми «Пройти верификацию» ещё раз.`;
        await interaction.reply({ embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral });
        return true;
    }

    clearFailures(interaction.user.id);
    return applyVerifiedRoles(interaction, config, guild, member);
}

// Шаг 2 (только если гендерные роли настроены): клик по ♂/♀ под сообщением
// из startVerification — сам пол здесь ещё не выдаётся, только запоминается
// в pendingGenderChoice до момента, когда участник также пройдёт проверку
// (см. handlePick / handleEmailModal). Кнопки живут на том же
// ephemeral-сообщении — правим его на месте через interaction.update().
async function handleGenderPick(interaction) {
    const config = await load();
    const picked = interaction.customId.slice(`${GENDER_PICK_PREFIX}:`.length);
    cleanupExpiredGenderChoices();
    pendingGenderChoice.set(interaction.user.id, { gender: picked, expiresAt: Date.now() + CHALLENGE_TTL_MS });
    await startChallenge(interaction, config, 'update');
    return true;
}

// Обработчик модалки ввода email (method === 'email').
async function handleEmailModal(interaction) {
    const config = await load();
    const guild = interaction.guild;

    if (!config.verification.enabled) {
        await interaction.reply({
            embeds: [errorEmbed('Верификация сейчас временно отключена администрацией.')],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    const email = interaction.fields.getTextInputValue(EMAIL_INPUT_ID).trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await interaction.reply({
            embeds: [errorEmbed('Некорректный email. Нажми кнопку верификации и попробуй снова.')],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    // Кулдаун — не чаще 1 письма в минуту на пользователя.
    if (await emailCodes.isOnCooldown(interaction.user.id)) {
        await interaction.reply({
            embeds: [warningEmbed('Подожди минуту перед повторной отправкой кода.')],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const code = generateEmailCode();

    try {
        await emailCodes.upsertCode(interaction.user.id, email, code);
        await sendVerificationCode(email, code, interaction.user.username, guild.name);
    } catch (err) {
        console.error('verification: не удалось отправить код:', err.message);
        await emailCodes.deleteCode(interaction.user.id).catch(() => {});
        await interaction.editReply({
            embeds: [errorEmbed('Не удалось отправить письмо. Попробуй позже или напиши модерации.')],
        });
        return true;
    }

    const button = new ButtonBuilder()
        .setCustomId(VERIFY_ENTER_CODE_BUTTON_ID)
        .setLabel('Ввести код')
        .setStyle(ButtonStyle.Success);

    await interaction.editReply({
        embeds: [
            baseEmbed(COLORS.primary).setDescription(
                formatBody('Код отправлен', `Проверь почту **${email}**. Код действует 10 минут.`)
            ),
        ],
        components: [new ActionRowBuilder().addComponents(button)],
    });
    return true;
}

// Кнопка "Ввести код" на ответе после отправки письма — открывает модалку
// для кода (не заставляем участника снова жать "Пройти верификацию").
async function handleEnterCodeButton(interaction) {
    await interaction.showModal(buildCodeModal());
    return true;
}

// Обработчик модалки ввода кода из письма.
async function handleCodeModal(interaction) {
    const config = await load();
    const guild = interaction.guild;
    const member = interaction.member;

    if (!config.verification.enabled) {
        await interaction.reply({
            embeds: [errorEmbed('Верификация сейчас временно отключена администрацией.')],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const row = await emailCodes.getCode(interaction.user.id);
    if (!row) {
        await interaction.editReply({
            embeds: [errorEmbed('Код не найден. Нажми кнопку верификации и начни заново.')],
        });
        return true;
    }

    if (Date.now() > new Date(row.expires_at).getTime()) {
        await emailCodes.deleteCode(interaction.user.id);
        await interaction.editReply({
            embeds: [errorEmbed('Код истёк. Нажми кнопку верификации и начни заново.')],
        });
        return true;
    }

    const input = interaction.fields.getTextInputValue(CODE_INPUT_ID).trim();
    if (input !== row.code) {
        const entry = await registerFailure(guild, member, config);
        const message = entry.lockedUntil
            ? `Неверный код. Слишком много неудачных попыток — новые попытки заблокированы на ${Math.round(config.verification.captchaLockoutMs / 60000)} мин.`
            : `Неверный код. Осталось попыток: ${Math.max(0, config.verification.maxCaptchaAttempts - entry.count)}.`;
        await interaction.editReply({ embeds: [errorEmbed(message)] });
        return true;
    }

    clearFailures(interaction.user.id);
    await emailCodes.deleteCode(interaction.user.id);

    return applyVerifiedRoles(interaction, config, guild, member, { deferred: true });
}

// Общий финал для капчи и email: выдать verifiedRole, снять unverifiedRole,
// выдать стартовую роль уровня и гендерную роль, залогировать и ответить.
// deferred === true — interaction уже в состоянии deferReply (email-путь),
// поэтому отвечаем через editReply; иначе (капча) — через reply.
async function applyVerifiedRoles(interaction, config, guild, member, { deferred = false } = {}) {
    const unverifiedRole = config.verification.unverifiedRoleId
        ? guild.roles.cache.get(config.verification.unverifiedRoleId)
        : null;
    const verifiedRole = config.verification.verifiedRoleId
        ? guild.roles.cache.get(config.verification.verifiedRoleId)
        : null;

    const reply = payload => (deferred ? interaction.editReply(payload) : interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }));

    try {
        if (unverifiedRole) await member.roles.remove(unverifiedRole, 'Верификация пройдена');
        if (verifiedRole) await member.roles.add(verifiedRole, 'Верификация пройдена');
    } catch (err) {
        console.error('verification: не удалось выдать роли:', err.message);
        await reply({ embeds: [errorEmbed('Не получилось выдать роль автоматически, обратись к администратору.')] });
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

    // Пол уже выбран ДО проверки (см. startVerification/handleGenderPick) и
    // ждал здесь в pendingGenderChoice — теперь, когда проверка тоже
    // пройдена, выдаём гендерную роль вместе с остальными. Best-effort,
    // как и стартовая роль уровня выше: если роль не настроена/не найдена
    // или Discord откажет в выдаче, это не должно ломать уже пройденную
    // верификацию.
    cleanupExpiredGenderChoices();
    const genderChoice = pendingGenderChoice.get(interaction.user.id);
    pendingGenderChoice.delete(interaction.user.id);
    if (genderChoice) {
        const genderRoleId =
            genderChoice.gender === 'male'
                ? config.verification.genderMaleRoleId
                : config.verification.genderFemaleRoleId;
        const otherGenderRoleId =
            genderChoice.gender === 'male'
                ? config.verification.genderFemaleRoleId
                : config.verification.genderMaleRoleId;
        const genderRole = genderRoleId ? guild.roles.cache.get(genderRoleId) : null;
        if (genderRole) {
            try {
                if (otherGenderRoleId && member.roles.cache.has(otherGenderRoleId)) {
                    await member.roles.remove(otherGenderRoleId, 'Смена выбора пола');
                }
                await member.roles.add(genderRole, 'Выбор пола при верификации');
            } catch (err) {
                console.error('verification: не удалось выдать гендерную роль:', err.message);
            }
        }
    }

    const passedEmbed = baseEmbed(COLORS.success).setDescription(
        formatBody('Верификация пройдена', 'Добро пожаловать!')
    );

    await reply({ embeds: [passedEmbed] });
    await log(
        guild,
        baseEmbed(COLORS.success)
            .setDescription(formatBody('Верификация пройдена'))
            .addFields({ name: 'Участник', value: `${member.user.tag} (${member.id})` })
    );
    return true;
}

async function handleButton(interaction) {
    if (interaction.customId === VERIFY_BUTTON_ID) return startVerification(interaction);
    if (interaction.customId === VERIFY_ENTER_CODE_BUTTON_ID) return handleEnterCodeButton(interaction);
    if (interaction.customId.startsWith(`${VERIFY_PICK_PREFIX}:`)) return handlePick(interaction);
    if (interaction.customId.startsWith(`${GENDER_PICK_PREFIX}:`)) return handleGenderPick(interaction);
    return false;
}

async function handleModal(interaction) {
    if (interaction.customId === VERIFY_EMAIL_MODAL_ID) return handleEmailModal(interaction);
    if (interaction.customId === VERIFY_CODE_MODAL_ID) return handleCodeModal(interaction);
    return false;
}

function register(client) {
    client.on('guildMemberAdd', member => handleJoin(member).catch(err => console.error('verification:', err)));
}

module.exports = { register, handleButton, handleModal, VERIFY_BUTTON_ID };