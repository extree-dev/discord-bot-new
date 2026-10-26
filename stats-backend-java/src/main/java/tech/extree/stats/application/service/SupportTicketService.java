package tech.extree.stats.application.service;

import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.UtcTime;
import tech.extree.stats.application.Validation;
import tech.extree.stats.application.port.in.SupportTicketUseCase;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.SupportTicketRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.LoginSession;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.TicketReply;
import tech.extree.stats.domain.User;

/**
 * Соответствует POST /api/support/tickets, GET /api/support/tickets/:token,
 * POST /api/support/tickets/:token/reply в server.js.
 */
@Service
public class SupportTicketService implements SupportTicketUseCase {

    private static final Logger log = LoggerFactory.getLogger(SupportTicketService.class);

    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final SupportTicketRepository supportTicketRepository;
    private final Mailer mailer;

    public SupportTicketService(
            SessionRepository sessionRepository, UserRepository userRepository, SupportTicketRepository supportTicketRepository, Mailer mailer) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.supportTicketRepository = supportTicketRepository;
        this.mailer = mailer;
    }

    @Override
    public CreateResult createTicket(
            String cookieValue, String rawBodyEmail, String rawSubject, String rawMessage, String rawCategory, String requestHost) {
        String userId = null;
        String email;

        Optional<User> sessionUser = resolveSessionUser(cookieValue);
        if (sessionUser.isPresent()) {
            userId = sessionUser.get().id();
            email = sessionUser.get().email();
        } else if (hasSessionButUserMissing(cookieValue)) {
            // Сессия валидна, но пользователь из неё удалён — тот же
            // invalid_request, что у Node в этом крайнем случае.
            return CreateResult.error(CreateOutcome.INVALID_REQUEST);
        } else {
            email = Validation.normalizeEmail(rawBodyEmail);
            if (!Validation.isValidEmail(email)) {
                return CreateResult.error(CreateOutcome.INVALID_EMAIL);
            }
        }

        String subject = rawSubject == null ? "" : rawSubject.trim();
        String message = rawMessage == null ? "" : rawMessage.trim();
        String category = rawCategory == null ? "" : rawCategory.trim();

        if (!Validation.isValidSubject(subject)) {
            return CreateResult.error(CreateOutcome.INVALID_SUBJECT);
        }
        if (!Validation.isValidMessage(message)) {
            return CreateResult.error(CreateOutcome.INVALID_MESSAGE);
        }
        if (!Validation.isValidCategory(category)) {
            return CreateResult.error(CreateOutcome.INVALID_CATEGORY);
        }
        if (supportTicketRepository.isOnCooldown(email)) {
            return CreateResult.error(CreateOutcome.CODE_ON_COOLDOWN);
        }

        try {
            SupportTicket ticket = supportTicketRepository.createTicket(userId, email, subject, message, category);
            String ticketUrl = ticketUrlFor(requestHost, ticket.viewToken());
            mailer.sendSupportTicketConfirmation(email, ticket.ticketNumber(), subject, ticketUrl);
            try {
                String adminUrl = adminTicketUrlFor(requestHost, ticket.ticketNumber());
                mailer.sendSupportTicketNotification(
                        ticket.ticketNumber(), email, subject, message, category, userId, adminUrl);
            } catch (Exception e) {
                // Письмо в поддержку не критично для самого факта подачи
                // заявки (она уже сохранена) — не роняем ответ, как и Node.
                log.warn("stats-backend-java: ошибка отправки уведомления команде поддержки", e);
            }
            return new CreateResult(CreateOutcome.OK, ticket.ticketNumber());
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка создания заявки в поддержку", e);
            return CreateResult.error(CreateOutcome.INTERNAL_ERROR);
        }
    }

    @Override
    public Optional<PublicTicketResult> getTicketByToken(String token) {
        Optional<SupportTicket> maybeTicket = supportTicketRepository.getTicketByToken(token);
        if (maybeTicket.isEmpty()) {
            return Optional.empty();
        }
        SupportTicket ticket = maybeTicket.get();
        List<ReplyView> replies = toReplyViews(supportTicketRepository.listReplies(ticket.id()));
        PublicTicketView view = new PublicTicketView(
                ticket.ticketNumber(), ticket.subject(), ticket.message(), ticket.status(), UtcTime.format(ticket.createdAt()));
        return Optional.of(new PublicTicketResult(view, replies));
    }

    @Override
    public ReplyOutcome replyAsUser(String token, String rawMessage, String requestHost) {
        Optional<SupportTicket> maybeTicket = supportTicketRepository.getTicketByToken(token);
        if (maybeTicket.isEmpty()) {
            return ReplyOutcome.TICKET_NOT_FOUND;
        }
        SupportTicket ticket = maybeTicket.get();
        if ("closed".equals(ticket.status())) {
            return ReplyOutcome.TICKET_CLOSED;
        }

        String message = rawMessage == null ? "" : rawMessage.trim();
        if (!Validation.isValidMessage(message)) {
            return ReplyOutcome.INVALID_MESSAGE;
        }
        if (supportTicketRepository.isReplyOnCooldown(ticket.id())) {
            return ReplyOutcome.CODE_ON_COOLDOWN;
        }

        try {
            supportTicketRepository.addReply(ticket.id(), "user", message);
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка ответа пользователя в тикете", e);
            return ReplyOutcome.INTERNAL_ERROR;
        }
        try {
            String adminUrl = adminTicketUrlFor(requestHost, ticket.ticketNumber());
            mailer.sendSupportTicketUserReply(ticket.ticketNumber(), ticket.email(), ticket.subject(), message, adminUrl);
        } catch (Exception e) {
            // Ответ уже сохранён и виден в треде — сбой письма не повод
            // говорить пользователю, что его ответ не отправился.
            log.warn("stats-backend-java: ошибка отправки уведомления команде поддержки об ответе", e);
        }
        return ReplyOutcome.OK;
    }

    static List<ReplyView> toReplyViews(List<TicketReply> replies) {
        return replies.stream()
                .map(r -> new ReplyView(r.id(), r.author(), r.message(), UtcTime.format(r.createdAt())))
                .toList();
    }

    static String ticketUrlFor(String requestHost, String viewToken) {
        return "https://" + requestHost + "/support/ticket/" + viewToken;
    }

    static String adminTicketUrlFor(String requestHost, long ticketNumber) {
        return "https://" + requestHost + "/admin/tickets/" + ticketNumber;
    }

    private Optional<User> resolveSessionUser(String cookieValue) {
        return resolveSession(cookieValue).flatMap(session -> userRepository.findById(session.userId()));
    }

    private boolean hasSessionButUserMissing(String cookieValue) {
        return resolveSession(cookieValue).isPresent();
    }

    private Optional<LoginSession> resolveSession(String cookieValue) {
        if (cookieValue == null) {
            return Optional.empty();
        }
        return sessionRepository.validate(cookieValue).filter(s -> s.userId() != null);
    }
}
