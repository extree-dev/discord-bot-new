package tech.extree.stats.adapter.in.web;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

/**
 * GET /api/admin/search?q= — глобальный поиск для Cmd+K.
 * Ищет по тикетам (subject/email/ticket_number) и юзерам (email/name/nickname).
 * Только для админов. LIMIT 5 на каждую категорию — палитра не про листинг.
 */
@RestController
public class AdminSearchController {

    private final SessionCodec sessionCodec;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    public AdminSearchController(SessionCodec sessionCodec, UserRepository userRepository, JdbcTemplate jdbcTemplate) {
        this.sessionCodec = sessionCodec;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    private Optional<User> resolveAdmin(String cookie) {
        if (cookie == null) return Optional.empty();
        Optional<Session> s = sessionCodec.decrypt(cookie).filter(x -> x.userId() != null);
        if (s.isEmpty()) return Optional.empty();
        return userRepository.findById(s.get().userId()).filter(User::isAdmin);
    }

    @GetMapping("/api/admin/search")
    public ResponseEntity<?> search(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie,
            @RequestParam(name = "q", required = false) String q) {
        if (resolveAdmin(cookie).isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse("forbidden"));
        }
        String query = (q == null ? "" : q.trim());
        if (query.length() < 2) {
            return ResponseEntity.ok(Map.of("tickets", List.of(), "users", List.of()));
        }
        String like = "%" + query.toLowerCase() + "%";

        List<Map<String, Object>> tickets = jdbcTemplate.query(
                "SELECT ticket_number, email, subject, status FROM stats_support_tickets " +
                        "WHERE lower(subject) LIKE ? OR lower(email) LIKE ? " +
                        "OR CAST(ticket_number AS TEXT) LIKE ? " +
                        "ORDER BY created_at DESC LIMIT 5",
                ticketMapper(), like, like, like);

        List<Map<String, Object>> users = jdbcTemplate.query(
                "SELECT id, email, name, nickname FROM stats_users " +
                        "WHERE lower(email) LIKE ? OR lower(coalesce(name, '')) LIKE ? " +
                        "OR lower(coalesce(nickname, '')) LIKE ? " +
                        "ORDER BY created_at DESC LIMIT 5",
                userMapper(), like, like, like);

        return ResponseEntity.ok(Map.of("tickets", tickets, "users", users));
    }

    private static RowMapper<Map<String, Object>> ticketMapper() {
        return (rs, n) -> Map.<String, Object>of(
                "number", rs.getLong("ticket_number"),
                "email", rs.getString("email"),
                "subject", rs.getString("subject"),
                "status", rs.getString("status"));
    }

    private static RowMapper<Map<String, Object>> userMapper() {
        return (rs, n) -> Map.<String, Object>of(
                "id", rs.getString("id"),
                "email", rs.getString("email"),
                "name", rs.getString("name") == null ? "" : rs.getString("name"),
                "nickname", rs.getString("nickname") == null ? "" : rs.getString("nickname"));
    }
}
