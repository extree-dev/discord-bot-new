// HTML-шаблоны визитки extree.tech ("/") и её редактора ("/admin") —
// рендерятся dashboard/server.js, стили берёт из уже существующего
// web/site/styles.css (та же статика на том же домене, см. web/Caddyfile:
// "/" и "/admin*" проксируются на dashboard, сам /styles.css — нет).
const { escapeHtml } = require('./views');

function page(title, description, body) {
    return `<!doctype html>
<html lang="ru">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <meta name="description" content="${escapeHtml(description)}" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="styles.css" />
    </head>
    <body>
        <div class="glow"></div>
        ${body}
    </body>
</html>`;
}

const ICON_LINK = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-8 13-7-5 1.2-1.6L12 14.7l5.8-4.3L19 12Z"/></svg>`;
const ICON_STATIC = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 5.3A17.6 17.6 0 0 0 15.9 4l-.3.6a15 15 0 0 1 3.9 1.5 16.6 16.6 0 0 0-13 0 15 15 0 0 1 4-1.5L10.1 4a17.6 17.6 0 0 0-4.4 1.3C2.8 9 2 12.6 2.3 16.2A17.8 17.8 0 0 0 7.6 19l.8-1.3a11 11 0 0 1-1.8-.9c.2-.1.3-.2.5-.3a12.7 12.7 0 0 0 10.2 0l.5.3c-.6.3-1.2.6-1.8.9l.8 1.3a17.8 17.8 0 0 0 5.3-2.8c.4-4.1-.6-7.7-2.8-11Zm-11 9c-1 0-1.7-.9-1.7-2s.8-2 1.7-2c1 0 1.8.9 1.7 2 0 1.1-.8 2-1.7 2Zm6.4 0c-.9 0-1.7-.9-1.7-2s.8-2 1.7-2c1 0 1.8.9 1.7 2 0 1.1-.7 2-1.7 2Z"/></svg>`;

function renderLinkRow(link, isFirstClickable) {
    if (!link.url) {
        return `<span class="link link--static">
            <span class="link__icon">${ICON_STATIC}</span>
            <span class="link__label">${escapeHtml(link.label)}</span>
        </span>`;
    }
    const primaryClass = isFirstClickable ? ' link--primary' : '';
    return `<a class="link${primaryClass}" href="${escapeHtml(link.url)}">
        <span class="link__icon">${ICON_LINK}</span>
        <span class="link__label">${escapeHtml(link.label)}</span>
        <span class="link__arrow">→</span>
    </a>`;
}

function renderVisitka(content) {
    let firstClickableUsed = false;
    const linksHtml = content.links
        .map(link => {
            const isFirstClickable = Boolean(link.url) && !firstClickableUsed;
            if (isFirstClickable) firstClickableUsed = true;
            return renderLinkRow(link, isFirstClickable);
        })
        .join('');

    return page(
        content.name,
        `${content.name} — ${content.role}.`,
        `
        <main class="card">
            <img class="avatar" src="assets/avatar.jpg" alt="${escapeHtml(content.name)}" width="112" height="112" />
            <h1>${escapeHtml(content.name)}</h1>
            <p class="role">${escapeHtml(content.role)}</p>
            <p class="bio">${escapeHtml(content.bio)}</p>
            <div class="links">${linksHtml}</div>
        </main>
        <footer class="footer">© ${escapeHtml(content.name)}</footer>
    `
    );
}

function renderSiteLogin() {
    return page(
        'Вход — Extree',
        'Вход для редактирования визитки extree.tech.',
        `
        <main class="card admin-card">
            <h1>Редактирование визитки</h1>
            <p class="bio">Войди через Discord — редактировать может только администратор сервера бота.</p>
            <a class="link link--primary admin-cta" href="/auth/discord/login">Войти через Discord</a>
        </main>
    `
    );
}

function renderSiteDenied() {
    return page(
        'Нет доступа — Extree',
        'Нет прав на редактирование визитки extree.tech.',
        `
        <main class="card admin-card">
            <h1>Нет доступа</h1>
            <p class="bio">Редактировать визитку может только администратор сервера, на котором работает бот.</p>
            <a class="link admin-cta" href="/auth/logout">Выйти и попробовать другим аккаунтом</a>
        </main>
    `
    );
}

function linkField(index, link) {
    const n = index + 1;
    return `
        <div class="field-row">
            <div class="field">
                <label for="link${n}_label">Ссылка ${n} — текст</label>
                <input type="text" id="link${n}_label" name="link${n}_label" value="${escapeHtml(link.label)}" maxlength="80" />
            </div>
            <div class="field">
                <label for="link${n}_url">Ссылка ${n} — URL (пусто = просто текст, без кнопки)</label>
                <input type="url" id="link${n}_url" name="link${n}_url" value="${escapeHtml(link.url)}" maxlength="300" placeholder="https://..." />
            </div>
        </div>`;
}

function renderSiteAdminForm(content, { saved = false, maxLinks } = {}) {
    const slots = [];
    for (let i = 0; i < maxLinks; i++) {
        slots.push(content.links[i] ?? { label: '', url: '' });
    }

    return page(
        'Редактирование визитки — Extree',
        'Редактирование визитки extree.tech.',
        `
        <main class="card admin-card admin-card--wide">
            <h1>Редактирование визитки</h1>
            <p class="bio">Правки применяются сразу — без деплоя. Пустой URL у ссылки делает её просто текстом (как сейчас "Discord: .extree").</p>
            ${saved ? '<p class="admin-notice">Сохранено.</p>' : ''}
            <form method="post" action="/admin" class="admin-form">
                <div class="field">
                    <label for="name">Имя</label>
                    <input type="text" id="name" name="name" value="${escapeHtml(content.name)}" maxlength="60" required />
                </div>
                <div class="field">
                    <label for="role">Роль / тэглайн</label>
                    <input type="text" id="role" name="role" value="${escapeHtml(content.role)}" maxlength="100" />
                </div>
                <div class="field">
                    <label for="bio">Био</label>
                    <textarea id="bio" name="bio" rows="3" maxlength="400">${escapeHtml(content.bio)}</textarea>
                </div>
                ${slots.map((link, i) => linkField(i, link)).join('')}
                <button type="submit" class="link link--primary admin-cta admin-submit">Сохранить</button>
            </form>
            <a class="admin-back" href="/auth/logout">Выйти</a>
        </main>
    `
    );
}

module.exports = { renderVisitka, renderSiteLogin, renderSiteDenied, renderSiteAdminForm };
