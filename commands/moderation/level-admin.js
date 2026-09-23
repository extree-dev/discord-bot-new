const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const leveling = require('../../leveling');
const { successEmbed } = require('../../utils/embeds');

// Отдельная команда, а не сабкоманды /level (откуда переехали set/reset) —
// Discord прячет от участника без нужного права только команду ЦЕЛИКОМ:
// setDefaultMemberPermissions действует на уровне top-level команды, а не
// отдельных сабкоманд внутри неё. /level должен быть виден всем (там
// profile/leaderboard), поэтому пока set/reset были его сабкомандами с
// проверкой прав только в execute(), Discord всё равно показывал их в
// автодополнении любому участнику — попытка вызвать упиралась в ту же
// runtime-проверку, но сама видимость в списке команд ничем не
// ограничивалась. Здесь же вся команда целиком скрыта от всех, кроме
// модерации.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('level-admin')
        .setDescription('Управление статистикой активности участников (модерация)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Задать счёт активности участнику вручную')
                .addUserOption(opt => opt.setName('user').setDescription('Кому').setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('amount').setDescription('Новое значение счёта').setRequired(true).setMinValue(0)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('reset')
                .setDescription('Сбросить статистику активности выбранным участникам')
                .addUserOption(opt => opt.setName('user1').setDescription('Кому').setRequired(true))
                .addUserOption(opt => opt.setName('user2').setDescription('Ещё (опционально)'))
                .addUserOption(opt => opt.setName('user3').setDescription('Ещё (опционально)'))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'set') {
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const result = await leveling.setScore(guildId, target.id, amount);

            // Роли ярусов складываются (см. leveling/model.js grantLevelRolesUpTo) —
            // ручная правка счёта может разом перепрыгнуть несколько ярусов,
            // поэтому выдаём все роли от первого яруса до текущего, а не
            // только роль последнего.
            await leveling.grantLevelRolesUpTo(interaction.guild, target.id, result.level.index);

            await interaction.reply({
                embeds: [
                    successEmbed(
                        `Счёт активности ${target} установлен: ${result.newScore} (${result.level.title}, уровень ${result.level.number}).`,
                        'Готово'
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // reset — сброс не всем, а точечно выбранным участникам (до трёх за
        // один вызов команды), в отличие от set не трогает роли ярусов
        // заданием нового счёта, а снимает их (см. leveling/model.js
        // resetStats).
        const targets = ['user1', 'user2', 'user3'].map(name => interaction.options.getUser(name)).filter(Boolean);
        const uniqueTargets = [...new Map(targets.map(u => [u.id, u])).values()];

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        for (const target of uniqueTargets) {
            await leveling.resetStats(interaction.guild, target.id);
        }
        await interaction.editReply({
            embeds: [successEmbed(`Статистика активности сброшена: ${uniqueTargets.join(', ')}.`, 'Готово')],
        });
    },
};
