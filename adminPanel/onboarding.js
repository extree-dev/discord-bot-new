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
    ChannelType,
    GuildOnboardingPromptType,
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
const ADD_CHANNELS_ID = `${PREFIX}add_channels`;

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
                  const targets = [...o.channels.values()].map(c => `<#${c.id}>`).join(', ');
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

async function addPrompt(guild, title, description, channels) {
    const current = await guild.fetchOnboarding();
    const newPrompt = {
        title,
        singleSelect: true,
        required: false,
        inOnboarding: true,
        type: GuildOnboardingPromptType.MultipleChoice,
        options: [{ title, description, channels, roles: [] }],
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
                ephemeral: true,
            });
            return;
        }
        await interaction.reply({ ...buildOnboardingMessage(data), ephemeral: true });
        return;
    }

    if (action === 'toggle') {
        await interaction.deferUpdate();
        try {
            const updated = await toggleEnabled(interaction.guild);
            await interaction.message.edit(buildOnboardingMessage(updated)).catch(() => {});
        } catch (err) {
            await interaction
                .followUp({ embeds: [errorEmbed(`Discord отклонил изменение: ${err.message}`)], ephemeral: true })
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
    }
}

async function handleModalSubmit(interaction) {
    if (interaction.customId === ADD_MODAL_ID) {
        const title = interaction.fields.getTextInputValue('title').trim();
        const description = interaction.fields.getTextInputValue('description')?.trim() || null;
        rememberPendingPrompt(interaction.user.id, title, description);

        const select = new ChannelSelectMenuBuilder()
            .setCustomId(ADD_CHANNELS_ID)
            .setPlaceholder('Какие каналы показать, если выберут этот вариант?')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setMinValues(1)
            .setMaxValues(5);
        await interaction.reply({
            content: `Вопрос «${title}» — выбери канал(ы), которые увидит участник, выбрав этот вариант:`,
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === REMOVE_MODAL_ID) {
        const raw = interaction.fields.getTextInputValue('index').trim();
        const index = Number.parseInt(raw, 10) - 1;
        if (!Number.isInteger(index)) {
            await interaction.reply({ embeds: [errorEmbed('Номер вопроса должен быть числом.')], ephemeral: true });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
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
    if (interaction.customId !== ADD_CHANNELS_ID) return false;

    const pending = takePendingPrompt(interaction.user.id);
    if (!pending) {
        await interaction.reply({
            embeds: [errorEmbed('Сессия добавления вопроса истекла — начни заново кнопкой «Добавить вопрос».')],
            ephemeral: true,
        });
        return true;
    }

    await interaction.deferReply({ ephemeral: true });
    const channels = [...interaction.channels.values()];
    const result = await addPrompt(interaction.guild, pending.title, pending.description, channels).catch(err => ({
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
