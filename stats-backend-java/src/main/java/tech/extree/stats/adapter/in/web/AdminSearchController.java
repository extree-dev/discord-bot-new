package tech.extree.stats.adapter.in.web;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.application.service.AdminSearchService;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.User;

/**
 * GET /api/admin/search?q= — глобальный поиск для Cmd+K. Только HTTP:
 * поиск и проверка прав — в AdminSearchService.
 */
@RestController
public class AdminSearchController {

    private final AdminSearchService adminSearchService;

    public AdminSearchController(AdminSearchService adminSearchService) {
        this.adminSearchService = adminSearchService;
    }

    @GetMapping("/api/admin/search")
    public ResponseEntity<?> search(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie,
            @RequestParam(name = "q", required = false) String q) {
        AdminSearchService.Result result = adminSearchService.search(cookie, q);
        if (result.outcome() == AdminSearchService.Outcome.FORBIDDEN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse("forbidden"));
        }
        return ResponseEntity.ok(Map.of(
                "tickets", toTicketViews(result.tickets()),
                "users", toUserViews(result.users())));
    }

    private static List<Map<String, Object>> toTicketViews(List<SupportTicket> tickets) {
        return tickets.stream()
                .<Map<String, Object>>map(t -> Map.of(
                        "number", t.ticketNumber(),
                        "email", t.email(),
                        "subject", t.subject(),
                        "status", t.status()))
                .toList();
    }

    private static List<Map<String, Object>> toUserViews(List<User> users) {
        return users.stream()
                .<Map<String, Object>>map(u -> Map.of(
                        "id", u.id(),
                        "email", u.email(),
                        "name", u.name() == null ? "" : u.name(),
                        "nickname", u.nickname() == null ? "" : u.nickname()))
                .toList();
    }
}
