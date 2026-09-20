// Уведомление в личку о наказании (бан/таймаут) — чтобы наказанный
// участник знал, за что и на сколько, а не просто "внезапно замолчал".
// Раньше личное сообщение отправлял только /warn — /ban и /timeout
// (и кнопка "Наказать" в тикетах-жалобах) участника вообще не уведомляли.
//
// APPEAL_BUTTON_CUSTOM_ID — кнопка "Подать апелляцию" добавляется только
// к DM о муте (не о бане, см. ниже) и открывает модалку создания тикета
// темы "appeal" прямо из личных сообщений — быстрый путь, не нужно идти
// искать панель тикетов на сервере. Мут здесь — не нативный Discord-
// таймаут (moderation/model.js специально его не использует именно
// из-за этого: во время таймаута участник не может нажать НИКАКУЮ
// кнопку и использовать НИКАКУЮ слэш-команду на самом сервере), а
// собственная роль "Muted" — она ограничивает только писать/
// реагировать/подключаться к голосу, поэтому участник и так может
// подать апелляцию прямо на сервере через обычную панель; эта кнопка —
// просто более короткий путь. Обработка клика — tickets/handlers.js
// handleAppealDmButton.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, baseEmbed, formatBody } = require('./embeds');

const APPEAL_BUTTON_CUSTOM_ID = 'ticket_appeal_dm';

// Ключ 'timeout' сохранён как есть во всех вызывающих местах
// (commands/moderation/timeout.js, tickets/model.js) — исторически от
// нативного Discord-таймаута, хотя с moderation/model.js это уже
// собственная роль "Muted", не таймаут; подпись для пользователя ниже
// это уже отражает.
const KIND_LABELS = {
    ban: 'Бан',
    timeout: 'Мут',
};

function buildAppealButtonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(APPEAL_BUTTON_CUSTOM_ID)
            .setLabel('Подать апелляцию')
            .setStyle(ButtonStyle.Secondary)
    );
}

// user — тот, кого наказали (discord.js User); guild — сервер, на котором
// применили наказание; kind — 'ban' | 'timeout'; durationLabel —
// человекочитаемая длительность (только для timeout). Для бана кнопку
// апелляции не показываем: после бана участник больше не состоит на
// сервере, а тред тикета можно открыть только добавив в него реального
// участника гильдии — кнопка бы просто ничего не смогла сделать и вводила
// бы в заблуждение. Молча ничего не делает, если у участника закрыты
// личные сообщения — это ожидаемый, не аварийный случай.
async function sendPunishmentDm(user, guild, { kind, reason, durationLabel }) {
    const fields = [
        {
            name: 'Наказание',
            value: durationLabel ? `${KIND_LABELS[kind]} (${durationLabel})` : KIND_LABELS[kind],
        },
        { name: 'Причина', value: reason },
    ];
    const components = [];
    if (kind === 'timeout') {
        fields.push({
            name: 'Не согласны?',
            value: 'Можете подать апелляцию прямо здесь, в личных сообщениях, кнопкой ниже.',
        });
        components.push(buildAppealButtonRow());
    }
    const embed = baseEmbed(COLORS.danger)
        .setDescription(formatBody(`Вы наказаны на сервере ${guild.name}`))
        .addFields(fields);
    await user.send({ embeds: [embed], components }).catch(() => {});
}

module.exports = { sendPunishmentDm, APPEAL_BUTTON_CUSTOM_ID };
