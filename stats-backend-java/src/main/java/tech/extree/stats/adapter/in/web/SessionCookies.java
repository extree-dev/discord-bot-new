package tech.extree.stats.adapter.in.web;

import java.time.Duration;
import org.springframework.http.ResponseCookie;

/**
 * Общий для всех контроллеров билдер session cookie — зеркалит
 * setSessionCookie в server.js (Node): httpOnly/secure/sameSite=Lax
 * всегда, Max-Age опускается при rememberMe=false (сессионная cookie,
 * браузер стирает её при закрытии), а не выставляется в 0 — это разные
 * вещи для браузера.
 */
final class SessionCookies {

    static final String SESSION_COOKIE = "extree_stats_session";
    private static final Duration SESSION_MAX_AGE = Duration.ofDays(7);

    private SessionCookies() {}

    static ResponseCookie build(String token, boolean rememberMe) {
        ResponseCookie.ResponseCookieBuilder builder =
                ResponseCookie.from(SESSION_COOKIE, token).httpOnly(true).secure(true).sameSite("Lax").path("/");
        if (rememberMe) {
            builder.maxAge(SESSION_MAX_AGE);
        }
        return builder.build();
    }
}
