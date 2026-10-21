package tech.extree.stats.adapter.in.web;

import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.application.port.in.GetSessionUseCase;
import tech.extree.stats.adapter.in.web.dto.SessionResponse;
import tech.extree.stats.domain.Session;

/** Соответствует GET /api/session в server.js (Node). */
@RestController
public class SessionController {

    private static final String SESSION_COOKIE = "extree_stats_session";

    private final GetSessionUseCase getSessionUseCase;

    public SessionController(GetSessionUseCase getSessionUseCase) {
        this.getSessionUseCase = getSessionUseCase;
    }

    @GetMapping("/api/session")
    public SessionResponse getSession(@CookieValue(name = SESSION_COOKIE, required = false) String cookie) {
        return getSessionUseCase
                .getSession(cookie)
                .map(Session::sub)
                .map(sub -> new SessionResponse(new SessionResponse.UserRef(sub)))
                .orElse(SessionResponse.empty());
    }
}
