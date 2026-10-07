// dashboard/server.js редиректит на /dashboard или /admin с одним из
// этих query-флагов после OAuth2/Telegram-потока — без чтения здесь
// страница просто тихо остаётся на экране логина, и попытка входа
// выглядит как "ничего не произошло", хотя на сервере всё отработало
// (например Telegram, которому просто некуда было войти — см.
// 'telegram-not-linked' ниже).
export type GateNotice = 'auth-error' | 'telegram-taken' | 'telegram-not-linked' | 'telegram-linked';

const FLAGS: { param: string; value: string; notice: GateNotice }[] = [
    // Порядок важен: 'telegram_taken' — отдельное значение auth_error,
    // проверяется раньше общего 'auth_error=1'.
    { param: 'auth_error', value: 'telegram_taken', notice: 'telegram-taken' },
    { param: 'auth_error', value: '1', notice: 'auth-error' },
    { param: 'telegram_not_linked', value: '1', notice: 'telegram-not-linked' },
    { param: 'telegram_linked', value: '1', notice: 'telegram-linked' },
];

const MESSAGES: Record<GateNotice, { variant: 'info' | 'error'; text: string }> = {
    'auth-error': { variant: 'error', text: 'Вход не завершился — ссылка устарела. Попробуй ещё раз.' },
    'telegram-taken': { variant: 'error', text: 'Этот Telegram уже привязан к другому аккаунту.' },
    'telegram-not-linked': {
        variant: 'error',
        text: 'Этот Telegram ещё не привязан ни к одному аккаунту — сначала войди через Discord, потом привяжи Telegram в карточке «Способы входа» на /dashboard.',
    },
    'telegram-linked': { variant: 'info', text: 'Telegram успешно привязан — теперь можно входить и через него.' },
};

export function gateNoticeMessage(notice: GateNotice) {
    return MESSAGES[notice];
}

export function consumeGateNotice(): GateNotice | null {
    const params = new URLSearchParams(window.location.search);
    for (const flag of FLAGS) {
        if (params.get(flag.param) !== flag.value) continue;
        params.delete(flag.param);
        const query = params.toString();
        const next = window.location.pathname + (query ? `?${query}` : '');
        window.history.replaceState(null, '', next);
        return flag.notice;
    }
    return null;
}
