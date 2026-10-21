package tech.extree.stats.application.port.in;

import java.util.List;
import java.util.Optional;

/**
 * Соответствует POST /api/support/tickets, GET /api/support/tickets/:token,
 * POST /api/support/tickets/:token/reply в server.js — публичная сторона
 * тикет-платформы (без входа или с сессией, но без прав админа).
 */
public interface SupportTicketUseCase {

    record ReplyView(String id, String author, String message, String time) {}

    enum CreateOutcome {
        OK,
        INVALID_REQUEST,
        INVALID_EMAIL,
        INVALID_SUBJECT,
        INVALID_MESSAGE,
        INVALID_CATEGORY,
        CODE_ON_COOLDOWN,
        INTERNAL_ERROR
    }

    record CreateResult(CreateOutcome outcome, Long ticketNumber) {
        public static CreateResult error(CreateOutcome outcome) {
            return new CreateResult(outcome, null);
        }
    }

    /**
     * Если cookieValue резолвится в действующую сессию — email аккаунта
     * используется и rawBodyEmail игнорируется (не даём залогиненному
     * притвориться другим отправителем), как и Node. requestHost — для
     * ссылки в письме-подтверждении.
     */
    CreateResult createTicket(
            String cookieValue, String rawBodyEmail, String subject, String message, String category, String requestHost);

    record PublicTicketView(long number, String subject, String message, String status, String time) {}

    record PublicTicketResult(PublicTicketView ticket, List<ReplyView> replies) {}

    Optional<PublicTicketResult> getTicketByToken(String token);

    enum ReplyOutcome {
        OK,
        TICKET_NOT_FOUND,
        TICKET_CLOSED,
        INVALID_MESSAGE,
        CODE_ON_COOLDOWN,
        INTERNAL_ERROR
    }

    ReplyOutcome replyAsUser(String token, String message, String requestHost);
}
