package tech.extree.stats.application.service;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.SupportTicketRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.LoginSession;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.User;

/**
 * Глобальный поиск для админ-палитры (Cmd+K): по тикетам
 * (subject/email/номер) и юзерам (email/name/nickname). Только для
 * админов. SRP: тот же слой (сервис над портами-репозиториями), что у
 * AdminTicketService/AdminAuditService — контроллер не трогает JDBC
 * напрямую.
 */
@Service
public class AdminSearchService {

    public enum Outcome { FORBIDDEN, OK }

    public record Result(Outcome outcome, List<SupportTicket> tickets, List<User> users) {
        static Result error(Outcome outcome) {
            return new Result(outcome, List.of(), List.of());
        }
    }

    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final SupportTicketRepository supportTicketRepository;

    public AdminSearchService(
            SessionRepository sessionRepository, UserRepository userRepository, SupportTicketRepository supportTicketRepository) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.supportTicketRepository = supportTicketRepository;
    }

    public Result search(String cookieValue, String rawQuery) {
        if (resolveAdmin(cookieValue).isEmpty()) {
            return Result.error(Outcome.FORBIDDEN);
        }
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < 2) {
            return new Result(Outcome.OK, List.of(), List.of());
        }
        String likeQuery = "%" + query.toLowerCase() + "%";
        return new Result(
                Outcome.OK,
                supportTicketRepository.searchTickets(likeQuery),
                userRepository.searchUsers(likeQuery));
    }

    private Optional<User> resolveAdmin(String cookieValue) {
        if (cookieValue == null) return Optional.empty();
        Optional<LoginSession> session = sessionRepository.validate(cookieValue).filter(s -> s.userId() != null);
        if (session.isEmpty()) return Optional.empty();
        return userRepository.findById(session.get().userId()).filter(User::isAdmin);
    }
}
