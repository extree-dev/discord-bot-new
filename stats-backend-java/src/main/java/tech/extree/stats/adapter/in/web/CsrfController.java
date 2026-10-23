package tech.extree.stats.adapter.in.web;

import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.application.service.CsrfTokenService;

import java.time.Duration;
import java.util.Map;

/**
 * GET /api/csrf-token — выдаёт новый CSRF-токен в cookie `csrf` и в теле.
 * Фронт читает из тела и шлёт в X-CSRF-Token. Cookie тоже ставится —
 * для double-submit.
 */
@RestController
public class CsrfController {

    private static final String CSRF_COOKIE = "csrf";
    private static final Duration CSRF_MAX_AGE = Duration.ofHours(2);

    private final CsrfTokenService csrfTokenService;

    public CsrfController(CsrfTokenService csrfTokenService) {
        this.csrfTokenService = csrfTokenService;
    }

    @GetMapping("/api/csrf-token")
    public ResponseEntity<?> issue() {
        String token = csrfTokenService.generate();
        ResponseCookie cookie = ResponseCookie.from(CSRF_COOKIE, token)
                .httpOnly(false)  // фронт должен читать
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(CSRF_MAX_AGE)
                .build();
        return ResponseEntity.ok()
                .header("Set-Cookie", cookie.toString())
                .body(Map.of("csrfToken", token));
    }
}