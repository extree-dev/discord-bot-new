// HTML-шаблоны дашборда — обычные шаблонные строки, без движка
// (EJS/Pug): всего две страницы, лишняя зависимость того не стоит,
// тот же принцип, что у остального бота (components.js собирает
// Discord-сообщения теми же template literals). styles.css —
// существующий файл web/bot-site/styles.css: Caddy отдаёт его статикой
// по тому же домену (см. web/Caddyfile), запрос /styles.css не попадает
// под проксируемые /auth и /dashboard пути, так что переиспользуется
// без дублирования.
function escapeHtml(str) {
    return String(str).replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
}

function layout(title, body) {
    return `<!doctype html>
<html lang="ru">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/styles.css" />
    </head>
    <body>
        <div class="glow"></div>
        <header class="nav">
            <a class="nav__brand" href="/"><span class="nav__badge">E</span>Extree</a>
            <nav class="nav__links"><a href="/#features">Возможности</a></nav>
        </header>
        <main class="dashboard">
            ${body}
        </main>
    </body>
</html>`;
}

function renderLogin() {
    return layout(
        'Вход — Extree',
        `
            <section class="dash-hero">
                <h1>Личный кабинет</h1>
                <p class="hero__lead">Войди через Discord, чтобы увидеть сервера, на которых есть и ты, и бот.</p>
                <a class="btn btn--primary" href="/auth/discord/login">Войти через Discord</a>
            </section>
        `
    );
}

function renderError(message) {
    return layout(
        'Не получилось — Extree',
        `
            <section class="dash-hero">
                <h1>Не получилось войти</h1>
                <p class="hero__lead">${escapeHtml(message)}</p>
                <a class="btn btn--primary" href="/auth/discord/login">Попробовать снова</a>
            </section>
        `
    );
}

function avatarUrl(user) {
    if (user.avatar) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
    }
    const fallbackIndex = Number(BigInt(user.id) % 5n);
    return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

function renderDashboard(user, guilds) {
    const guildItems = guilds.length
        ? guilds
              .map(g => {
                  const icon = g.icon
                      ? `<img class="guild-item__icon" src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64" alt="" width="40" height="40" />`
                      : `<span class="guild-item__icon guild-item__icon--placeholder">${escapeHtml(g.name.slice(0, 1))}</span>`;
                  return `<li class="guild-item">${icon}<span>${escapeHtml(g.name)}</span></li>`;
              })
              .join('')
        : `<li class="guild-item guild-item--empty">Пока ни одного сервера, где ты администратор и уже добавлен Extree.</li>`;

    return layout(
        'Кабинет — Extree',
        `
            <section class="dash-hero">
                <img class="avatar avatar--small" src="${avatarUrl(user)}" alt="" width="56" height="56" />
                <h1>Привет, ${escapeHtml(user.username)}</h1>
                <p class="hero__lead">Сервера, где есть и ты (с правами администратора), и бот Extree.</p>
            </section>
            <ul class="guild-list">${guildItems}</ul>
            <p class="dash-note">Пока только просмотр — управление настройками бота прямо отсюда появится позже.</p>
            <a class="btn btn--ghost" href="/auth/logout">Выйти</a>
        `
    );
}

module.exports = { renderLogin, renderError, renderDashboard, escapeHtml };
