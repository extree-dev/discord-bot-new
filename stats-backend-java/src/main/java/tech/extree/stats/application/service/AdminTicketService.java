package tech.extree.stats.application.service;

import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.UtcTime;
import tech.extree.stats.application.Validation;
import tech.extree.stats.application.port.in.AdminTicketUseCase;
import tech.extree.stats.application.port.in.SupportTicketUseCase.ReplyView;
import tech.extree.stats.application.port.out.AdminAuditRepository;
import tech.extree.stats.application.port.out.CannedResponseRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.SupportTicketRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.CannedResponse;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.User;

@Service
public class AdminTicketService implements AdminTicketUseCase {

    private static final Logger log = LoggerFactory.getLogger(AdminTicketService.class);
    private static final List<String> TICKET_STATUSES = List.of("open", "in_progress", "closed");

    private final SessionCodec sessionCodec;
    private final UserRepository userRepository;
    private final SupportAdminEmails supportAdminEmails;
    private final SupportTicketRepository supportTicketRepository;
    private final CannedResponseRepository cannedResponseRepository;
    private final Mailer mailer;
    private final AdminAuditRepository auditRepository;

    public AdminTicketService(
            SessionCodec sessionCodec,
            UserRepository userRepository,
            SupportAdminEmails supportAdminEmails,
            SupportTicketRepository supportTicketRepository,
            CannedResponseRepository cannedResponseRepository,
            Mailer mailer, AdminAuditRepository auditRepository) {
        this.sessionCodec = sessionCodec;
        this.userRepository = userRepository;
        this.supportAdminEmails = supportAdminEmails;
        this.supportTicketRepository = supportTicketRepository;
        this.cannedResponseRepository = cannedResponseRepository;
        this.mailer = mailer;
        this.auditRepository = auditRepository;
    }

    @Override
    public ListResult listTickets(String cookieValue, String status) {
        AdminAccess access = resolveAdmin(cookieValue);
        if (!access.hasSession()) {
            return ListResult.error(ListOutcome.UNAUTHORIZED);
        }
        if (access.admin() == null) {
            return ListResult.error(ListOutcome.FORBIDDEN);
        }
        String normalizedStatus = (status == null || status.isBlank()) ? null : status;
        if (normalizedStatus != null && !TICKET_STATUSES.contains(normalizedStatus)) {
            return ListResult.error(ListOutcome.INVALID_REQUEST);
        }

        List<AdminTicketSummary> summaries = supportTicketRepository.listTickets(normalizedStatus).stream()
                .map(t -> new AdminTicketSummary(
                        t.ticketNumber(), t.email(), t.subject(), t.category(), t.status(), UtcTime.format(t.createdAt())))
                .toList();
        return new ListResult(ListOutcome.OK, summaries);
    }

    @Override
    public DetailResult getTicket(String cookieValue, String rawTicketNumber) {
        AdminAccess access = resolveAdmin(cookieValue);
        if (!access.hasSession()) {
            return DetailResult.error(DetailOutcome.UNAUTHORIZED);
        }
        if (access.admin() == null) {
            return DetailResult.error(DetailOutcome.FORBIDDEN);
        }

        Optional<SupportTicket> maybeTicket = findTicket(rawTicketNumber);
        if (maybeTicket.isEmpty()) {
            return DetailResult.error(DetailOutcome.TICKET_NOT_FOUND);
        }
        SupportTicket ticket = maybeTicket.get();

        boolean isUserVerified = false;
        if (ticket.userId() != null) {
            isUserVerified = userRepository.findById(ticket.userId())
                    .map(User::isVerified)
                    .orElse(false);
        }

        AdminTicketDetail detail = new AdminTicketDetail(
                ticket.ticketNumber(),
                ticket.userId(),
                ticket.email(),
                ticket.subject(),
                ticket.message(),
                ticket.category(),
                ticket.status(),
                UtcTime.format(ticket.createdAt()),
                isUserVerified
        );
        List<ReplyView> replies = SupportTicketService.toReplyViews(supportTicketRepository.listReplies(ticket.id()));
        return new DetailResult(DetailOutcome.OK, detail, replies);
    }

    @Override
    public ReplyOutcome reply(String cookieValue, String rawTicketNumber, String rawMessage, String requestHost) {
        AdminAccess access = resolveAdmin(cookieValue);
        if (!access.hasSession()) {
            return ReplyOutcome.UNAUTHORIZED;
        }
        User admin = access.admin();
        if (admin == null) {
            return ReplyOutcome.FORBIDDEN;
        }

        String message = rawMessage == null ? "" : rawMessage.trim();
        if (!Validation.isValidMessage(message)) {
            return ReplyOutcome.INVALID_MESSAGE;
        }

        Optional<SupportTicket> maybeTicket = findTicket(rawTicketNumber);
        if (maybeTicket.isEmpty()) {
            return ReplyOutcome.TICKET_NOT_FOUND;
        }
        SupportTicket ticket = maybeTicket.get();

        supportTicketRepository.addReply(ticket.id(), "admin", message);
        audit(admin, "ticket.reply", "ticket", String.valueOf(ticket.ticketNumber()), "{\"reply\":true}");
        if ("open".equals(ticket.status())) {
            supportTicketRepository.setStatus(ticket.id(), "in_progress");
        }

        try {
            String adminName = admin.name() != null && !admin.name().isBlank() ? admin.name() : "Support";
            String ticketUrl = SupportTicketService.ticketUrlFor(requestHost, ticket.viewToken());
            mailer.sendSupportTicketReply(ticket.email(), ticket.ticketNumber(), ticket.subject(), message, adminName, ticketUrl);
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка отправки уведомления об ответе на тикет", e);
        }
        return ReplyOutcome.OK;
    }

    @Override
    public StatusOutcome setStatus(String cookieValue, String rawTicketNumber, String status) {
        AdminAccess access = resolveAdmin(cookieValue);
        if (!access.hasSession()) {
            return StatusOutcome.UNAUTHORIZED;
        }
        if (access.admin() == null) {
            return StatusOutcome.FORBIDDEN;
        }
        User admin = access.admin();
        if (!TICKET_STATUSES.contains(status)) {
            return StatusOutcome.INVALID_REQUEST;
        }

        Optional<SupportTicket> maybeTicket = findTicket(rawTicketNumber);
        if (maybeTicket.isEmpty()) {
            return StatusOutcome.TICKET_NOT_FOUND;
        }
        SupportTicket t = maybeTicket.get();
        supportTicketRepository.setStatus(t.id(), status);
        audit(admin, "ticket.status", "ticket", String.valueOf(t.ticketNumber()), "{\"status\":\"" + status + "\"}");
        return StatusOutcome.OK;
    }

    @Override
    public CannedListResult listCannedResponses(String cookieValue) {
        AdminAccess access = resolveAdmin(cookieValue);
        if (!access.hasSession()) {
            return CannedListResult.error(CannedListOutcome.UNAUTHORIZED);
        }
        if (access.admin() == null) {
            return CannedListResult.error(CannedListOutcome.FORBIDDEN);
        }
        List<CannedResponseView> views = cannedResponseRepository.list().stream()
                .map(r -> new CannedResponseView(r.id(), r.title(), r.body()))
                .toList();
        return new CannedListResult(CannedListOutcome.OK, views);
    }

    @Override
    public CannedCreateResult createCannedResponse(String cookieValue, String rawTitle, String rawBody) {
        AdminAccess access = resolveAdmin(cookieValue);
        if (!access.hasSession()) {
            return CannedCreateResult.error(CannedCreateOutcome.UNAUTHORIZED);
        }
        if (access.admin() == null) {
            return CannedCreateResult.error(CannedCreateOutcome.FORBIDDEN);
        }

        String title = rawTitle == null ? "" : rawTitle.trim();
        String body = rawBody == null ? "" : rawBody.trim();
        if (!Validation.isValidSubject(title)) {
            return CannedCreateResult.error(CannedCreateOutcome.INVALID_SUBJECT);
        }
        if (!Validation.isValidMessage(body)) {
            return CannedCreateResult.error(CannedCreateOutcome.INVALID_MESSAGE);
        }

        String id = cannedResponseRepository.create(title, body);
        audit(access.admin(), "canned.create", "canned", id, "{\"title\":\"canned\"}");
        return new CannedCreateResult(CannedCreateOutcome.OK, id);
    }

    @Override
    public CannedDeleteOutcome deleteCannedResponse(String cookieValue, String id) {
        AdminAccess access = resolveAdmin(cookieValue);
        if (!access.hasSession()) {
            return CannedDeleteOutcome.UNAUTHORIZED;
        }
        if (access.admin() == null) {
            return CannedDeleteOutcome.FORBIDDEN;
        }
        cannedResponseRepository.delete(id);
        audit(access.admin(), "canned.delete", "canned", id, null);
        return CannedDeleteOutcome.OK;
    }

    private Optional<SupportTicket> findTicket(String rawTicketNumber) {
        try {
            long ticketNumber = Long.parseLong(rawTicketNumber);
            return supportTicketRepository.getTicketByNumber(ticketNumber);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private record AdminAccess(boolean hasSession, User admin) {}

    private AdminAccess resolveAdmin(String cookieValue) {
        if (cookieValue == null) {
            return new AdminAccess(false, null);
        }
        Optional<Session> session = sessionCodec.decrypt(cookieValue).filter(s -> s.userId() != null);
        if (session.isEmpty()) {
            return new AdminAccess(false, null);
        }
        Optional<User> user = userRepository.findById(session.get().userId());
        if (user.isEmpty() || !supportAdminEmails.isAdmin(user.get())) {
            return new AdminAccess(true, null);
        }
        return new AdminAccess(true, user.get());
    }

    private void audit(User admin, String action, String targetType, String targetId, String metadataJson) {
        if (admin == null) return;
        try {
            auditRepository.record(admin.id(), action, targetType, targetId, metadataJson, null);
        } catch (Exception e) {
            log.warn("stats-backend-java: не удалось записать audit {} {}", action, targetId, e);
        }
    }
}