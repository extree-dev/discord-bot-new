// Telegram Login Widget привязывается в @BotFather ровно к ОДНОМУ
// домену (ограничение самого виджета, не наше) — выбран bot.extree.tech
// (сам кабинет), поэтому кнопку есть смысл показывать только там, а не
// на extree.tech/admin, где она всё равно не заработает. Тот же
// критерий домена, что уже использует dashboard/server.js
// (defaultReturnPathFor: host.startsWith('bot.')).
export function isDashboardDomain(): boolean {
    return window.location.hostname.startsWith('bot.');
}
