package tech.extree.stats.adapter.in.web;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.application.port.out.LoginEventRepository;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.application.service.UserAgentParser;
import tech.extree.stats.domain.LoginEvent;
import tech.extree.stats.domain.LoginSession;
import tech.extree.stats.domain.User;

/**
 * /api/account/login-history — список последних входов (для вкладки Recent Sign-ins).
 * /api/account/logout-session/{id} — удалить ОДНУ ЗАПИСЬ из истории входов
 * И отозвать привязанную к ней сессию (см. SessionRepository) — раньше
 * (чисто stateless cookie, без серверного реестра токенов) это было
 * невозможно, кнопка только чистила историю, реальный токен устройства
 * оставался рабочим до истечения Max-Age. Записи старше этой функции
 * (session_id = NULL) по-прежнему просто удаляются из истории — отзывать
 * у них нечего.
 */
@RestController
public class LoginEventController {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_INSTANT;

    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final LoginEventRepository loginEventRepository;

    public LoginEventController(
            SessionRepository sessionRepository, UserRepository userRepository, LoginEventRepository loginEventRepository) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.loginEventRepository = loginEventRepository;
    }

    @GetMapping("/api/account/login-history")
    public ResponseEntity<?> history(@CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        Optional<User> user = currentUser(cookie);
        if (user.isEmpty()) return status(HttpStatus.UNAUTHORIZED, "unauthorized");

        List<LoginEvent> events = loginEventRepository.listRecent(user.get().id(), 10);
        List<Map<String, Object>> result = events.stream()
                .map(e -> Map.<String, Object>of(
                        "id", e.id(),
                        "ip", e.ip(),
                        "country", e.country(),
                        "city", e.city(),
                        "time", ISO.format(e.createdAt()),
                        "device", UserAgentParser.describe(e.userAgent())))
                .toList();
        return ResponseEntity.ok(Map.of("events", result));
    }

    @PostMapping("/api/account/logout-session/{id}")
    public ResponseEntity<?> logoutSession(
            @PathVariable String id,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        Optional<User> user = currentUser(cookie);
        if (user.isEmpty()) return status(HttpStatus.UNAUTHORIZED, "unauthorized");
        // Сначала узнаём session_id (если есть) — пока сама запись истории
        // ещё не удалена, иначе отзывать уже будет нечего смотреть.
        loginEventRepository.findSessionId(user.get().id(), id).ifPresent(sessionId -> sessionRepository.revokeById(user.get().id(), sessionId));
        boolean ok = loginEventRepository.deleteById(user.get().id(), id);
        return ok ? ResponseEntity.ok(OkResponse.OK) : status(HttpStatus.NOT_FOUND, "session_not_found");
    }

    private Optional<User> currentUser(String cookie) {
        if (cookie == null) return Optional.empty();
        Optional<LoginSession> s = sessionRepository.validate(cookie);
        if (s.isEmpty() || s.get().userId() == null) return Optional.empty();
        return userRepository.findById(s.get().userId());
    }

    private static ResponseEntity<ErrorResponse> status(HttpStatus status, String error) {
        return ResponseEntity.status(status).body(new ErrorResponse(error));
    }
}
