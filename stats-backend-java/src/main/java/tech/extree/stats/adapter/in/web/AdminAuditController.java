package tech.extree.stats.adapter.in.web;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.application.port.out.AdminAuditRepository;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.AdminAuditEntry;
import tech.extree.stats.domain.LoginSession;
import tech.extree.stats.domain.User;

/** GET /api/admin/audit — список действий админов (только для админов). */
@RestController
public class AdminAuditController {

    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final AdminAuditRepository auditRepository;

    public AdminAuditController(
            SessionRepository sessionRepository,
            UserRepository userRepository,
            AdminAuditRepository auditRepository) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.auditRepository = auditRepository;
    }

    @GetMapping("/api/admin/audit")
    public ResponseEntity<?> list(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        Optional<User> admin = resolveAdmin(cookie);
        if (admin.isEmpty()) return status(HttpStatus.UNAUTHORIZED, "unauthorized");
        if (!admin.get().isAdmin()) return status(HttpStatus.FORBIDDEN, "forbidden");
        if (limit < 1 || limit > 200) limit = 50;
        if (offset < 0) offset = 0;
        List<AdminAuditEntry> entries = auditRepository.list(limit, offset);
        return ResponseEntity.ok(Map.of("entries", entries));
    }

    private Optional<User> resolveAdmin(String cookie) {
        if (cookie == null) return Optional.empty();
        Optional<LoginSession> s = sessionRepository.validate(cookie);
        if (s.isEmpty() || s.get().userId() == null) return Optional.empty();
        return userRepository.findById(s.get().userId());
    }

    private static ResponseEntity<ErrorResponse> status(HttpStatus s, String e) {
        return ResponseEntity.status(s).body(new ErrorResponse(e));
    }
}