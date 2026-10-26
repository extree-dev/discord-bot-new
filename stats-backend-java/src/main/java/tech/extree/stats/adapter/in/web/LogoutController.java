package tech.extree.stats.adapter.in.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.application.port.out.SessionRepository;

/**
 * Соответствует GET /auth/logout в server.js: чистит cookie, редиректит на
 * "/". С серверным реестром сессий (SessionRepository) логаут теперь ещё
 * и отзывает сам токен — раньше (чисто stateless cookie) отозвать было
 * нечего, logout был чисто косметическим на клиенте.
 */
@RestController
public class LogoutController {

    private final SessionRepository sessionRepository;

    public LogoutController(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    @GetMapping("/auth/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        if (cookie != null) {
            sessionRepository.revoke(cookie);
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.SET_COOKIE, SessionCookies.clear().toString())
                .header(HttpHeaders.LOCATION, "/")
                .build();
    }
}
