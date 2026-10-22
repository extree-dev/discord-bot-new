package tech.extree.stats.adapter.in.web;

import java.time.Duration;
import org.springframework.http.ResponseCookie;

/**
 * Общий для всех контроллеров билдер session cookie — зеркалит
 * setSessionCookie в server.js (Node): httpOnly/secure/sameSite=Lax
 * всегда, Max-Age опускается при rememberMe=false (сессионная cookie,
 * браузер стирает её при закрытии), а не выставляется в 0 — это разные
 * вещи для браузера.
 *
 * buildState/clearState — для OAuth2 state-cookie (/auth/riot/*), тот же
 * приём, что STATE_COOKIE в server.js: имя задаётся вызывающим кодом
 * (extree_stats_oauth_state), maxAge 10 минут.
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

    /** Соответствует res.clearCookie(SESSION_COOKIE, {...}) в /auth/logout (server.js). */
    static ResponseCookie clear() {
        return ResponseCookie.from(SESSION_COOKIE, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
    }

    /** OAuth2 state-cookie (см. STATE_COOKIE в server.js) — 10 минут жизни. */
    static ResponseCookie buildState(String name, String value, int maxAgeSeconds) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .build();
    }

    /** clearCookie для state после колбэка — та же схема, что в server.js (res.clearCookie(STATE_COOKIE)). */
    static ResponseCookie clearState(String name) {
        return ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
    }
}