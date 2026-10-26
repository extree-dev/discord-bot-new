package tech.extree.stats.application.port.in;

import java.util.List;
import tech.extree.stats.application.port.in.SupportTicketUseCase.ReplyView;

public interface AdminTicketUseCase {

    record AdminTicketSummary(long number, String email, String subject, String category, String status, String time) {}

    enum ListOutcome {
        OK, UNAUTHORIZED, FORBIDDEN, INVALID_REQUEST
    }

    record ListResult(ListOutcome outcome, List<AdminTicketSummary> tickets) {
        public static ListResult error(ListOutcome outcome) {
            return new ListResult(outcome, List.of());
        }
    }

    ListResult listTickets(String cookieValue, String status);

    record AdminTicketDetail(
            long number,
            String userId,
            String email,
            String subject,
            String message,
            String category,
            String status,
            String time,
            boolean isUserVerified) {}

    enum DetailOutcome {
        OK, UNAUTHORIZED, FORBIDDEN, TICKET_NOT_FOUND
    }

    record DetailResult(DetailOutcome outcome, AdminTicketDetail ticket, List<ReplyView> replies) {
        public static DetailResult error(DetailOutcome outcome) {
            return new DetailResult(outcome, null, List.of());
        }
    }

    DetailResult getTicket(String cookieValue, String rawTicketNumber);

    enum ReplyOutcome {
        OK, UNAUTHORIZED, FORBIDDEN, INVALID_MESSAGE, TICKET_NOT_FOUND
    }

    ReplyOutcome reply(String cookieValue, String rawTicketNumber, String message, String requestHost);

    enum StatusOutcome {
        OK, UNAUTHORIZED, FORBIDDEN, INVALID_REQUEST, TICKET_NOT_FOUND
    }

    StatusOutcome setStatus(String cookieValue, String rawTicketNumber, String status);

    record CannedResponseView(String id, String title, String body) {}

    enum CannedListOutcome {
        OK, UNAUTHORIZED, FORBIDDEN
    }

    record CannedListResult(CannedListOutcome outcome, List<CannedResponseView> responses) {
        public static CannedListResult error(CannedListOutcome outcome) {
            return new CannedListResult(outcome, List.of());
        }
    }

    CannedListResult listCannedResponses(String cookieValue);

    enum CannedCreateOutcome {
        OK, UNAUTHORIZED, FORBIDDEN, INVALID_SUBJECT, INVALID_MESSAGE
    }

    record CannedCreateResult(CannedCreateOutcome outcome, String id) {
        public static CannedCreateResult error(CannedCreateOutcome outcome) {
            return new CannedCreateResult(outcome, null);
        }
    }

    CannedCreateResult createCannedResponse(String cookieValue, String title, String body);

    enum CannedDeleteOutcome {
        OK, UNAUTHORIZED, FORBIDDEN
    }

    CannedDeleteOutcome deleteCannedResponse(String cookieValue, String id);
}