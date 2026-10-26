package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.application.port.in.RiotAuthUseCase;
import tech.extree.stats.application.service.RiotAuthService;

/**
 * Соответствует /auth/riot/login и /auth/riot/callback в server.js (Node).
 *
 * /auth/riot/login:
 *   - RIOT_CLIENT_ID не задан → 302 /?auth_error=1 (без похода в Riot)
 *   - иначе: ставит state-cookie (httpOnly/secure/sameSite=Lax/maxAge 10 мин)
 *     и редиректит на authorize URL Riot.
 *
 * /auth/riot/callback:
 *   - state не совпадает/нет code/ошибка обмена → 302 /?auth_error=1
 *   - успех → ставит extree_stats_session (7 дней) и редиректит на "/".
 *
 * Имя state-cookie — extree_stats_oauth_state (как в server.js: STATE_COOKIE).
 */
@RestController
public class RiotAuthController {

    private static final String STATE_COOKIE = "extree_stats_oauth_state";
    private static final int STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

    private final RiotAuthUseCase riotAuthUseCase;
    private final String publicHost;

    public RiotAuthController(RiotAuthUseCase riotAuthUseCase, @Value("${extree.public-host}") String publicHost) {
        this.riotAuthUseCase = riotAuthUseCase;
        this.publicHost = publicHost;
    }

    @GetMapping("/auth/riot/login")
    public ResponseEntity<Void> login() {
        String state = RiotAuthService.newState();
        String redirectUrl = riotAuthUseCase.buildLoginRedirect(publicHost, state);
        if (redirectUrl == null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, "/?auth_error=1")
                    .build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(
                        HttpHeaders.SET_COOKIE,
                        SessionCookies.buildState(STATE_COOKIE, state, STATE_COOKIE_MAX_AGE_SECONDS)
                                .toString())
                .header(HttpHeaders.LOCATION, redirectUrl)
                .build();
    }

    @GetMapping("/auth/riot/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @CookieValue(name = STATE_COOKIE, required = false) String expectedState,
            HttpServletRequest httpRequest) {
        RiotAuthUseCase.CallbackResult result = riotAuthUseCase.handleCallback(
                publicHost, code, state, expectedState, ClientIp.from(httpRequest), httpRequest.getHeader("User-Agent"));
        if (!result.ok()) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.SET_COOKIE, SessionCookies.clearState(STATE_COOKIE).toString())
                    .header(HttpHeaders.LOCATION, "/?auth_error=1")
                    .build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.SET_COOKIE, SessionCookies.clearState(STATE_COOKIE).toString())
                .header(HttpHeaders.SET_COOKIE, SessionCookies.build(result.sessionCookie(), true).toString())
                .header(HttpHeaders.LOCATION, "/")
                .build();
    }
}