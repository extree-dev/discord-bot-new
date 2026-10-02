// Доменный слой памятки — по прямому запросу администратора ("сделай канал
// типа как на скрине с другого сервера"): сводка для новых участников по
// структуре сервера, вместо того чтобы разбираться самим. Визуальный язык —
// тот же, что у rules/ (Components V2, баннер-разделы вместо текстовых
// заголовков, см. memo/banners.js), содержимое — не копия чужого сервера
// (там были свои уникальные системы вроде браков/экономики, которых у нас
// нет), а то, что реально есть в этом боте: реальные команды из
// commands/general/, реальные каналы (по их ID, если уже настроены) и
// реальные роли.
const { MediaGalleryBuilder } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const { getBannerAttachments } = require('./banners');
const leveling = require('../leveling');

const ACCENT = COLORS.primary;

// id — ID канала, если фича уже настроена и сохранила его в своём
// config-store; name — запасной текст на случай, когда id ещё нет
// (администратор не запускал --bootstrap для этой фичи) — тот же приём,
// что buildIdeaSubmitLine в rules/model.js: ссылка живая, когда можно,
// иначе просто название, а не битое упоминание.
function mention(id, name) {
    return id ? `<#${id}>` : `#${name}`;
}

function buildCards(ids = {}) {
    const levelPath = leveling.LEVELS.map(l => l.title).join(' → ');

    return [
        {
            title: 'Добро пожаловать',
            icon: 'book',
            body: `Это памятка по серверу — что где находится и как всё устроено. Сначала — ${mention(ids.rulesChannelId, 'правила')}, обязательны для всех. Доступ к остальным каналам открывается сразу после капчи при входе — ничего отдельно подтверждать не нужно.`,
        },
        {
            title: 'Каналы сервера',
            icon: 'info',
            body: `${mention(ids.rulesChannelId, 'правила')} — правила сервера. ${mention(ids.newsChannelId, 'новости-сервера')} — обновления бота. ${mention(ids.levelChannelId, 'рейтинг')} — топ активности участников. ${mention(ids.ticketChannelId, 'открыть-тикет')} — пожаловаться на игрока. ${mention(ids.ideaButtonChannelId, 'предложить-идею')} — предложить идею, ${mention(ids.ideaResultsChannelId, 'предложения')} — одобренные идеи. Отдельная категория «🎮 Новости игр» — новости по играм, на которые подписан через роли.`,
        },
        {
            title: 'Поддержка',
            icon: 'lifebuoy',
            body: `Жалоба на игрока — кнопка в ${mention(ids.ticketChannelId, 'открыть-тикет')}, не чаще раза в 30 минут: бот заведёт приватный тред с модерацией. Идея — кнопка в ${mention(ids.ideaButtonChannelId, 'предложить-идею')}${ids.ideaDirectChannelId ? ` или сообщением прямо в ${mention(ids.ideaDirectChannelId, 'предложения')}` : ''} — проверяется вручную, без автопубликации.`,
        },
        {
            title: 'Команды бота',
            icon: 'command',
            body: '/rules — правила. /help — список всех команд. /level profile и /level leaderboard — профиль и топ активности. /serverinfo и /userinfo — информация о сервере/участнике. /changelog — что нового в последних обновлениях. /version — версия бота. /ping — задержка бота.',
        },
        {
            title: 'Роли',
            icon: 'role',
            body: `Уровень активности растёт от сообщений и времени в голосовых, роль яруса выдаётся автоматически: ${levelPath}. Роли по играм и интересам — через «Каналы и роли» в меню сервера. Роль за буст сервера — свои бонусы поверх уровня активности.`,
        },
        {
            title: 'Голосовые комнаты',
            icon: 'mic',
            body: `Заходишь в ${mention(ids.voiceTriggerChannelId, 'Создать комнату')} — бот создаёт личную временную комнату и переносит тебя туда. Лимит участников, лок и блокировка конкретных пользователей — кнопками прямо в комнате, без команд.`,
        },
    ];
}

function buildMemoMessage(ids) {
    const banners = getBannerAttachments();
    const containers = buildCards(ids).map(({ body }, i) =>
        baseContainer(ACCENT)
            .addMediaGalleryComponents(new MediaGalleryBuilder().addItems({ media: { url: banners[i].url } }))
            .addSeparatorComponents(separator())
            .addTextDisplayComponents(textDisplay(body))
    );
    return { ...toMessage(...containers), files: banners.map(b => b.attachment) };
}

// Только для проверок формата в тестах — сама отправка всегда идёт через
// buildMemoMessage().
function getAllMemoText(ids) {
    return buildCards(ids)
        .map(c => `${c.title}\n\n${c.body}`)
        .join('\n\n');
}

module.exports = { buildMemoMessage, getAllMemoText };
