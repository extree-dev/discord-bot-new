const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const security = require('../../security');
const { successEmbed } = require('../../utils/embeds');

// Явная настройка ролей верификации через Discord role-picker — без
// этого setup-verification.js мог бы найти/угадать нужную роль только
// по имени, а если у сервера уже есть своя роль под другим именем (или
// администратор хочет именно конкретную роль), приходилось бы либо
// переименовывать её, либо получить дубликат. Команда пишет ID роли
// напрямую в конфиг, никаких повторных деплоев не требуется.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('verification-role')
        .setDescription('Указать, какую роль система верификации должна выдавать/снимать')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('verified')
                .setDescription('Роль, которая выдаётся после успешного прохождения верификации')
                .addRoleOption(opt => opt.setName('role').setDescription('Роль').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('unverified')
                .setDescription('Роль, которая выдаётся новым участникам до верификации')
                .addRoleOption(opt => opt.setName('role').setDescription('Роль').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('gender-male')
                .setDescription('Роль для варианта "Мужчина" в шаге выбора пола после верификации')
                .addRoleOption(opt => opt.setName('role').setDescription('Роль').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('gender-female')
                .setDescription('Роль для варианта "Женщина" в шаге выбора пола после верификации')
                .addRoleOption(opt => opt.setName('role').setDescription('Роль').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const role = interaction.options.getRole('role');

        const FIELD_BY_SUB = {
            verified: 'verifiedRoleId',
            unverified: 'unverifiedRoleId',
            'gender-male': 'genderMaleRoleId',
            'gender-female': 'genderFemaleRoleId',
        };
        await security.updateConfig(config => {
            config.verification[FIELD_BY_SUB[sub]] = role.id;
        });

        const LABEL_BY_SUB = {
            verified: 'выдаваемая после верификации',
            unverified: 'выдаваемая до верификации',
            'gender-male': 'выдаваемая за выбор "Мужчина"',
            'gender-female': 'выдаваемая за выбор "Женщина"',
        };
        const label = LABEL_BY_SUB[sub];
        await interaction.reply({
            embeds: [successEmbed(`Роль, ${label}: ${role}.`, 'Сохранено')],
            flags: MessageFlags.Ephemeral,
        });
    },
};
