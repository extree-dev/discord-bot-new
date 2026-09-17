// Доменный слой системы предложений: построение панели/embed'а
// предложения и сама операция "предложить идею" (резервирование номера +
// публикация в канал). Роутинг взаимодействий — в suggestions/handlers.js.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { update } = require('./config');
const { COLORS, baseEmbed } = require('../utils/embeds');

function buildPanelMessage() {
    const embed = baseEmbed(COLORS.primary)
        .setTitle('💡 Предложи идею')
        .setDescription(
            'Есть мысль, как сделать сервер лучше? Нажми кнопку ниже и опиши идею — ' +
                'она будет опубликована в канале предложений для обсуждения командой и другими участниками.'
        )
        .setFooter({ text: 'Заголовок и описание — в модальном окне, это займёт меньше минуты' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('suggestion_open')
            .setLabel('Предложить идею')
            .setEmoji('💡')
            .setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
}

function buildSuggestionEmbed({ member, title, description, number }) {
    return baseEmbed(COLORS.warning)
        .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
        .setTitle(`💡 ${title}`)
        .setDescription(description)
        .addFields(
            { name: 'Автор', value: `${member}`, inline: true },
            { name: 'Статус', value: '🆕 Новое', inline: true }
        )
        .setFooter({ text: `Предложение #${number}` });
}

async function createSuggestion(interaction, { title, description }) {
    // Резервирование номера и чтение outputChannelId — одной атомарной
    // операцией по той же причине, что и в tickets/model.js: два
    // предложения, отправленных почти одновременно, не должны получить
    // один номер.
    const reservation = await update(config => {
        config.counter += 1;
        return { number: config.counter, outputChannelId: config.outputChannelId };
    });

    if (!reservation.outputChannelId) {
        return { error: 'Канал для предложений не настроен. Обратитесь к администратору сервера.' };
    }

    const outputChannel = interaction.guild.channels.cache.get(reservation.outputChannelId);
    if (!outputChannel) {
        return { error: 'Канал для предложений не найден. Обратитесь к администратору сервера.' };
    }

    const embed = buildSuggestionEmbed({
        member: interaction.member,
        title,
        description,
        number: reservation.number,
    });
    await outputChannel.send({ embeds: [embed] });

    return { number: reservation.number };
}

module.exports = { buildPanelMessage, buildSuggestionEmbed, createSuggestion };
