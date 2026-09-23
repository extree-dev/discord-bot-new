// Управление "Адаптацией" (Discord Onboarding) с панели администратора —
// первоначальные вопросы ставит scripts/setup-onboarding.js один раз,
// дальше администратор смотрит/включает-выключает/добавляет/убирает
// вопросы прямо отсюда, без похода в настройки сервера. Discord API для
// адаптации редактируется только целиком (PUT), поэтому каждая операция
// ниже — fetchOnboarding() -> точечная правка -> editOnboarding() с
// полным набором данных, а не частичный patch.
const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelType,
    GuildOnboardingPromptType,
    MessageFlags,
} = require('discord.js');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const { COLORS, errorEmbed, successEmbed } = require('../utils/embeds');

const PREFIX = 'admin_panel_onboarding:';
const OPEN_ID = `${PREFIX}open`;
const TOGGLE_ID = `${PREFIX}toggle`;
const REFRESH_ID = `${PREFIX}refresh`;
const ADD_ID = `${PREFIX}add`;
const REMOVE_ID = `${PREFIX}remove`;
const ADD_MODAL_ID = `${PREFIX}add_modal`;
const REMOVE_MODAL_ID = `${PREFIX}remove_modal`;
// Большинство каналов сервера закрыты от новых участников ролью
// Unverified до капчи (security/verification.js) — вопрос, "открывающий"
// такой канал, для них бесполезен. Поэтому после текста вопроса
// спрашиваем, что именно выдаёт выбранный вариант: канал (для тех
// немногих, что видны всем) или чисто декоративную роль без прав.
const ADD_TARGET_CHANNEL_ID = `${PREFIX}add_target_channel`;
const ADD_TARGET_ROLE_ID = `${PREFIX}add_target_role`;
const ADD_CHANNELS_ID = `${PREFIX}add_channels`;
const ADD_ROLES_ID = `${PREFIX}add_roles`;

// Пока админ заполняет модалку "Добавить вопрос" (шаг 1 — заголовок и
// описание), а затем выбирает каналы через ChannelSelectMenu (шаг 2), надо
// пронести текст между двумя разными interaction'ами — тот же приём, что
// pendingChallenges в security/verification.js. TTL короткий: это
// редкий админский флоу, а не что-то, что должно жить долго.
const PENDING_TTL_MS = 5 * 60 * 1000;
const pendingPrompts = new Map(); // userId -> { title, description, expiresAt }

function rememberPendingPrompt(userId, title, description) {
    for (const [id, entry] of pendingPrompts) {
        if (Date.now() > entry.expiresAt) pendingPrompts.delete(id);
    }
    pendingPrompts.set(userId, { title, description, expiresAt: Date.now() + PENDING_TTL_MS });
}

function takePendingPrompt(userId) {
    const entry = pendingPrompts.get(userId);
    pendingPrompts.delete(userId);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry;
}

function buildOnboardingMessage(onboarding) {
    const prompts = [...onboarding.prompts.values()];
    const defaultChannels = [...onboarding.defaultChannels.values()];

    const summaryLines = [
        '### Адаптация участников',
        `- Статус: ${onboarding.enabled ? 'Включена' : 'Выключена'}`,
        `- Каналы по умолчанию: ${defaultChannels.length ? defaultChannels.map(c => `<#${c.id}>`).join(', ') : 'нет'}`,
    ];

    const promptLines = prompts.length
        ? prompts.flatMap((p, i) => [
              `${i + 1}. **${p.title}**${p.required ? ' — обязателен' : ''}`,
              ...[...p.options.values()].map(o => {
                  const targets = [
                      ...[...o.channels.values()].map(c => `<#${c.id}>`),
                      ...[...o.roles.values()].map(r => `<@&${r.id}>`),
                  ].join(', ');
                  return `   - ${o.title}${targets ? ` → ${targets}` : ''}`;
              }),
          ])
        : ['Вопросов пока нет — добавь первый кнопкой ниже.'];

    const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(TOGGLE_ID)
            .setLabel(onboarding.enabled ? 'Выключить' : 'Включить')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(REFRESH_ID).setLabel('Обновить').setStyle(ButtonStyle.Secondary)
    );
    const editRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(ADD_ID).setLabel('Добавить вопрос').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(REMOVE_ID).setLabel('Удалить вопрос').setStyle(ButtonStyle.Secondary)
    );

    const container = baseContainer(COLORS.primary)
        .addTextDisplayComponents(textDisplay(summaryLines.join('\n')))
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(textDisplay(['### Вопросы', ...promptLines].join('\n')))
        .addSeparatorComponents(separator())
        .addActionRowComponents(toggleRow, editRow);

    return toMessage(container);
}

function buildAddModal() {
    return new ModalBuilder()
        .setCustomId(ADD_MODAL_ID)
        .setTitle('Новый вопрос адаптации')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Текст вопроса')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(60)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Пояснение (необязательно)')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false)
            )
        );
}

function buildRemoveModal() {
    return new ModalBuilder()
        .setCustomId(REMOVE_MODAL_ID)
        .setTitle('Удалить вопрос адаптации')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('index')
                    .setLabel('Номер вопроса (см. список в панели)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('1')
                    .setRequired(true)
            )
        );
}

async function toggleEnabled(guild) {
    const current = await guild.fetchOnboarding();
    return guild.editOnboarding({
        prompts: [...current.prompts.values()],
        defaultChannels: [...current.defaultChannels.values()],
        enabled: !current.enabled,
        mode: current.mode,
        reason: 'Панель администратора: переключение адаптации',
    });
}

async function addPrompt(guild, title, description, { channels = [], roles = [] }) {
    const current = await guild.fetchOnboarding();
    const newPrompt = {
        title,
        singleSelect: true,
        required: false,
        inOnboarding: true,
        type: GuildOnboardingPromptType.MultipleChoice,
        options: [{ title, description, channels, roles }],
    };
    return guild.editOnboarding({
        prompts: [...current.prompts.values(), newPrompt],
        defaultChannels: [...current.defaultChannels.values()],
        enabled: current.enabled,
        mode: current.mode,
        reason: 'Панель администратора: добавлен вопрос адаптации',
    });
}

async function removePromptAt(guild, index) {
    const current = await guild.fetchOnboarding();
    const prompts = [...current.prompts.values()];
    if (index < 0 || index >= prompts.length) {
        return { error: `Нет вопроса под номером ${index + 1} — всего вопросов: ${prompts.length}.` };
    }
    prompts.splice(index, 1);
    await guild.editOnboarding({
        prompts,
        defaultChannels: [...current.defaultChannels.values()],
        enabled: current.enabled,
        mode: current.mode,
        reason: 'Панель администратора: удалён вопрос адаптации',
    });
    return { ok: true };
}

async function handleButton(interaction) {
    const action = interaction.customId.slice(PREFIX.length);

    if (action === 'open') {
        const data = await interaction.guild.fetchOnboarding().catch(() => null);
        if (!data) {
            await interaction.reply({
                embeds: [errorEmbed('Не удалось получить данные адаптации от Discord.')],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        const message = buildOnboardingMessage(data);
        await interaction.reply({ ...message, flags: message.flags | MessageFlags.Ephemeral });
        return;
    }

    if (action === 'toggle') {
        await interaction.deferUpdate();
        try {
            const updated = await toggleEnabled(interaction.guild);
            await interaction.message.edit(buildOnboardingMessage(updated)).catch(() => {});
        } catch (err) {
            await interaction
                .followUp({
                    embeds: [errorEmbed(`Discord отклонил изменение: ${err.message}`)],
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
        return;
    }

    if (action === 'refresh') {
        await interaction.deferUpdate();
        const data = await interaction.guild.fetchOnboarding().catch(() => null);
        if (data) await interaction.message.edit(buildOnboardingMessage(data)).catch(() => {});
        return;
    }

    if (action === 'add') {
        await interaction.showModal(buildAddModal());
        return;
    }

    if (action === 'remove') {
        await interaction.showModal(buildRemoveModal());
        return;
    }

    // Шаг 2 добавления вопроса — заголовок/описание собраны (модалка),
    // теперь выбираем, что выдаёт вариант ответа: канал или роль (см.
    // комментарий у ADD_TARGET_CHANNEL_ID выше). interaction.update() —
    // меняет то же ephemeral-сообщение с двумя кнопками на select-меню
    // нужного типа, отдельного ответа не создаёт.
    if (action === 'add_target_channel' || action === 'add_target_role') {
        const pending = pendingPrompts.get(interaction.user.id);
        if (!pending || Date.now() > pending.expiresAt) {
            await interaction.update({
                content: 'Сессия добавления вопроса истекла — начни заново кнопкой «Добавить вопрос».',
                components: [],
            });
            return;
        }

        if (action === 'add_target_channel') {
            const select = new ChannelSelectMenuBuilder()
                .setCustomId(ADD_CHANNELS_ID)
                .setPlaceholder('Какие каналы показать, если выберут этот вариант?')
                .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setMinValues(1)
                .setMaxValues(5);
            await interaction.update({
                content: `Вопрос «${pending.title}» — выбери канал(ы), которые увидит участник, выбрав этот вариант:`,
                components: [new ActionRowBuilder().addComponents(select)],
            });
            return;
        }

        const select = new RoleSelectMenuBuilder()
            .setCustomId(ADD_ROLES_ID)
            .setPlaceholder('Какую роль выдать, если выберут этот вариант?')
            .setMinValues(1)
            .setMaxValues(5);
        await interaction.update({
            content: `Вопрос «${pending.title}» — выбери роль(и), которые получит участник, выбрав этот вариант:`,
            components: [new ActionRowBuilder().addComponents(select)],
        });
    }
}

async function handleModalSubmit(interaction) {
    if (interaction.customId === ADD_MODAL_ID) {
        const title = interaction.fields.getTextInputValue('title').trim();
        const description = interaction.fields.getTextInputValue('description')?.trim() || null;
        rememberPendingPrompt(interaction.user.id, title, description);

        const targetRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(ADD_TARGET_CHANNEL_ID)
                .setLabel('Открыть канал')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(ADD_TARGET_ROLE_ID).setLabel('Дать роль').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({
            content: `Вопрос «${title}» — что выдаёт этот вариант ответа?`,
            components: [targetRow],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    if (interaction.customId === REMOVE_MODAL_ID) {
        const raw = interaction.fields.getTextInputValue('index').trim();
        const index = Number.parseInt(raw, 10) - 1;
        if (!Number.isInteger(index)) {
            await interaction.reply({
                embeds: [errorEmbed('Номер вопроса должен быть числом.')],
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await removePromptAt(interaction.guild, index).catch(err => ({ error: err.message }));
        if (result.error) {
            await interaction.editReply({ embeds: [errorEmbed(result.error)] });
            return true;
        }
        await interaction.editReply({
            embeds: [successEmbed('Вопрос удалён. Обнови панель адаптации, чтобы увидеть список.', 'Готово')],
        });
        return true;
    }

    return false;
}

async function handleSelectMenu(interaction) {
    const isChannelTarget = interaction.customId === ADD_CHANNELS_ID;
    const isRoleTarget = interaction.customId === ADD_ROLES_ID;
    if (!isChannelTarget && !isRoleTarget) return false;

    const pending = takePendingPrompt(interaction.user.id);
    if (!pending) {
        await interaction.reply({
            embeds: [errorEmbed('Сессия добавления вопроса истекла — начни заново кнопкой «Добавить вопрос».')],
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const targets = isChannelTarget
        ? { channels: [...interaction.channels.values()] }
        : { roles: [...interaction.roles.values()] };
    const result = await addPrompt(interaction.guild, pending.title, pending.description, targets).catch(err => ({
        error: err.message,
    }));
    if (result.error) {
        await interaction.editReply({ embeds: [errorEmbed(`Discord отклонил изменение: ${result.error}`)] });
        return true;
    }
    await interaction.editReply({
        embeds: [
            successEmbed(`Вопрос «${pending.title}» добавлен. Обнови панель адаптации, чтобы увидеть его.`, 'Готово'),
        ],
    });
    return true;
}

module.exports = {
    PREFIX,
    OPEN_ID,
    handleButton,
    handleModalSubmit,
    handleSelectMenu,
    buildOnboardingMessage,
};
