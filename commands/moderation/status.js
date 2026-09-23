const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const presence = require('../../presence');
const { COLORS, baseEmbed, formatBody, errorEmbed, successEmbed } = require('../../utils/embeds');

const TYPE_CHOICES = [
    { name: 'Играет в', value: 'playing' },
    { name: 'Смотрит', value: 'watching' },
    { name: 'Слушает', value: 'listening' },
    { name: 'Участвует в', value: 'competing' },
];

const PRESENCE_CHOICES = [
    { name: 'Онлайн', value: 'online' },
    { name: 'Не активен', value: 'idle' },
    { name: 'Не беспокоить', value: 'dnd' },
    { name: 'Невидимый', value: 'invisible' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Управление статусом бота (текст активности, ротация)')
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Задать фиксированный статус (отключает ротацию)')
                .addStringOption(opt =>
                    opt
                        .setName('text')
                        .setDescription('Текст статуса. Можно использовать {members} и {uptime}')
                        .setRequired(true)
                        .setMaxLength(128)
                )
                .addStringOption(opt =>
                    opt
                        .setName('type')
                        .setDescription('Тип активности')
                        .setRequired(false)
                        .addChoices(...TYPE_CHOICES)
                )
                .addStringOption(opt =>
                    opt
                        .setName('presence')
                        .setDescription('Онлайн-статус бота')
                        .setRequired(false)
                        .addChoices(...PRESENCE_CHOICES)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('rotate-add')
                .setDescription('Добавить пункт в ротацию статусов')
                .addStringOption(opt =>
                    opt
                        .setName('text')
                        .setDescription('Текст. Можно использовать {members} и {uptime}')
                        .setRequired(true)
                        .setMaxLength(128)
                )
                .addStringOption(opt =>
                    opt
                        .setName('type')
                        .setDescription('Тип активности')
                        .setRequired(false)
                        .addChoices(...TYPE_CHOICES)
                )
        )
        .addSubcommand(sub => sub.setName('rotate-clear').setDescription('Очистить список ротации и выключить её'))
        .addSubcommand(sub =>
            sub
                .setName('rotate-toggle')
                .setDescription('Включить/выключить ротацию (нужен хотя бы один пункт)')
                .addStringOption(opt =>
                    opt
                        .setName('state')
                        .setDescription('on/off')
                        .setRequired(true)
                        .addChoices({ name: 'Включить', value: 'on' }, { name: 'Выключить', value: 'off' })
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('interval')
                .setDescription('Интервал переключения ротации, в минутах')
                .addIntegerOption(opt =>
                    opt
                        .setName('minutes')
                        .setDescription('От 1 до 1440')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(1440)
                )
        )
        .addSubcommand(sub => sub.setName('show').setDescription('Показать текущие настройки статуса'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const text = interaction.options.getString('text');
            const typeKey = interaction.options.getString('type') ?? 'playing';
            const presenceStatus = interaction.options.getString('presence');
            await presence.updateConfig(cfg => {
                cfg.rotate = false;
                cfg.activity = { type: presence.ACTIVITY_TYPES[typeKey], text };
                if (presenceStatus) cfg.status = presenceStatus;
            });
            await presence.applyCurrentPresence(interaction.client);
            return interaction.reply({
                embeds: [
                    successEmbed(
                        `${presence.ACTIVITY_LABELS[presence.ACTIVITY_TYPES[typeKey]]} «${text}»`,
                        'Статус обновлён'
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'rotate-add') {
            const text = interaction.options.getString('text');
            const typeKey = interaction.options.getString('type') ?? 'playing';
            const count = await presence.updateConfig(cfg => {
                cfg.rotateItems.push({ type: presence.ACTIVITY_TYPES[typeKey], text });
                return cfg.rotateItems.length;
            });
            return interaction.reply({
                embeds: [
                    successEmbed(`Пунктов в ротации: ${count}. Включи её через /status rotate-toggle on.`, 'Добавлено'),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'rotate-clear') {
            await presence.updateConfig(cfg => {
                cfg.rotate = false;
                cfg.rotateItems = [];
                cfg.rotateIndex = 0;
            });
            await presence.applyCurrentPresence(interaction.client);
            return interaction.reply({
                embeds: [successEmbed('Список ротации очищен, ротация выключена.', 'Готово')],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'rotate-toggle') {
            const state = interaction.options.getString('state') === 'on';
            const config = await presence.getConfig();
            if (state && config.rotateItems.length === 0) {
                return interaction.reply({
                    embeds: [errorEmbed('В ротации пока нет ни одного пункта — добавь через /status rotate-add.')],
                    flags: MessageFlags.Ephemeral,
                });
            }
            await presence.updateConfig(cfg => {
                cfg.rotate = state;
                cfg.lastRotatedAt = Date.now();
            });
            await presence.applyCurrentPresence(interaction.client);
            return interaction.reply({
                embeds: [successEmbed(state ? 'Ротация включена.' : 'Ротация выключена.', 'Готово')],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'interval') {
            const minutes = interaction.options.getInteger('minutes');
            await presence.updateConfig(cfg => {
                cfg.rotateIntervalMs = minutes * 60 * 1000;
            });
            return interaction.reply({
                embeds: [successEmbed(`Интервал ротации: ${minutes} мин.`, 'Готово')],
                flags: MessageFlags.Ephemeral,
            });
        }

        const config = await presence.getConfig();
        const lines = [`**Онлайн-статус:** ${config.status}`];
        if (config.rotate && config.rotateItems.length) {
            lines.push(`**Ротация:** включена, каждые ${config.rotateIntervalMs / 60000} мин.`);
            config.rotateItems.forEach((item, i) => {
                lines.push(`  ${i + 1}. ${presence.ACTIVITY_LABELS[item.type] ?? item.type} «${item.text}»`);
            });
        } else {
            lines.push('**Ротация:** выключена');
            lines.push(
                config.activity.text
                    ? `**Статус:** ${presence.ACTIVITY_LABELS[config.activity.type] ?? config.activity.type} «${config.activity.text}»`
                    : '**Статус:** не задан'
            );
        }
        const embed = baseEmbed(COLORS.primary).setDescription(`${formatBody('Статус бота')}\n\n${lines.join('\n')}`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
