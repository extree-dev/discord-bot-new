package tech.extree.stats.application.port.out;

import java.util.List;
import java.util.Optional;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.TicketReply;

/** Соответствует supportTickets.js (Node) — stats_support_tickets/stats_support_ticket_replies. */
public interface SupportTicketRepository {
    /** Возвращает id/viewToken/ticketNumber — те же поля, что RETURNING у createTicket в Node. */
    SupportTicket createTicket(String userId, String email, String subject, String message, String category);

    boolean isOnCooldown(String email);

    boolean isReplyOnCooldown(String ticketId);

    /** status == null — без фильтра (все статусы), как и Node. */
    List<SupportTicket> listTickets(String status);

    Optional<SupportTicket> getTicketByNumber(long ticketNumber);

    Optional<SupportTicket> getTicketByToken(String viewToken);

    List<TicketReply> listReplies(String ticketId);

    void addReply(String ticketId, String author, String message);

    void setStatus(String ticketId, String status);
}
