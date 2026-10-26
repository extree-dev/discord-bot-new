package tech.extree.stats.application.port.in;

/**
 * Соответствует /auth/riot/login и /auth/riot/callback в server.js (Node).
 * Возвращает {@code null} из buildLoginRedirect, если RIOT_CLIENT_ID не
 * задан — контроллер в этом случае редиректит на /?auth_error=1, как и
 * Node (не поход в Riot с пустым client_id).
 */
public interface RiotAuthUseCase {

    /**
     * URL для редиректа на auth.riotgames.com/authorize, либо {@code null},
     * если RIOT_CLIENT_ID не задан (см. класс-комментарий).
     * {@code requestHost} — Host-заголовок запроса (для redirect_uri,
     * тот же приём, что redirectUriFor в server.js).
     */
    String buildLoginRedirect(String requestHost, String state);

    /**
     * Обрабатывает /auth/riot/callback: сверяет state, обменивает код,
     * достаёт sub из /userinfo и заводит серверную сессию (тем же
     * SessionRepository, что и остальные способы входа — формат cookie
     * та же extree_stats_session).
     */
    CallbackResult handleCallback(
            String requestHost, String code, String state, String expectedState, String clientIp, String userAgent);

    record CallbackResult(boolean ok, String sessionCookie) {
        public static CallbackResult error() {
            return new CallbackResult(false, null);
        }
    }
}