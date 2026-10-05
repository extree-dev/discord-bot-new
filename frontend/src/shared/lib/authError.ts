// dashboard/server.js редиректит сюда с ?auth_error=1, если OAuth2-поток
// не завершился (битый/просроченный state, Discord не ответил на обмен
// кода на токен) — раньше это нигде не читалось: страница просто тихо
// оставалась на экране логина, так что повторные попытки выглядели как
// бесконечный цикл без единого объяснения, что пошло не так.
export function consumeAuthErrorFlag(): boolean {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_error') !== '1') return false;

    params.delete('auth_error');
    const query = params.toString();
    const next = window.location.pathname + (query ? `?${query}` : '');
    window.history.replaceState(null, '', next);
    return true;
}
