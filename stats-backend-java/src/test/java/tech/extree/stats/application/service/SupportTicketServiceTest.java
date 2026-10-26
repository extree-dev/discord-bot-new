package tech.extree.stats.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tech.extree.stats.application.port.in.SupportTicketUseCase;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.SupportTicketRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.LoginSession;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.User;

class SupportTicketServiceTest {

    private SessionRepository sessionRepository;
    private UserRepository userRepository;
    private SupportTicketRepository supportTicketRepository;
    private Mailer mailer;
    private SupportTicketService service;

    // 11 аргументов
    private final User user = new User(
            "user-id", "test@test.com", "hashed", Instant.now(), null, "Test", "test", null, false, false, false);

    @BeforeEach
    void setUp() {
        sessionRepository = mock(SessionRepository.class);
        userRepository = mock(UserRepository.class);
        supportTicketRepository = mock(SupportTicketRepository.class);
        mailer = mock(Mailer.class);

        when(sessionRepository.validate("cookie")).thenReturn(Optional.of(new LoginSession("session-id", null, "user-id", 0)));
        when(userRepository.findById("user-id")).thenReturn(Optional.of(user));

        service = new SupportTicketService(sessionRepository, userRepository, supportTicketRepository, mailer);
    }

    @Test
    void createTicketCooldown() {
        when(supportTicketRepository.isOnCooldown("test@test.com")).thenReturn(true);
        var result = service.createTicket("cookie", null, "Subject", "Message", "bug", "host");
        assertEquals(SupportTicketUseCase.CreateOutcome.CODE_ON_COOLDOWN, result.outcome());
    }

    @Test
    void createTicketOk() {
        when(supportTicketRepository.isOnCooldown("test@test.com")).thenReturn(false);
        SupportTicket ticket = new SupportTicket(
                "t1", "user-id", "test@test.com", "Subject", "Message", "bug", "open", "token", 1L, Instant.now());
        when(supportTicketRepository.createTicket("user-id", "test@test.com", "Subject", "Message", "bug"))
                .thenReturn(ticket);

        var result = service.createTicket("cookie", null, "Subject", "Message", "bug", "host");
        assertEquals(SupportTicketUseCase.CreateOutcome.OK, result.outcome());
        assertEquals(1L, result.ticketNumber());
        verify(mailer).sendSupportTicketConfirmation(eq("test@test.com"), eq(1L), eq("Subject"), anyString());
        verify(mailer).sendSupportTicketNotification(eq(1L), eq("test@test.com"), eq("Subject"), eq("Message"),
                eq("bug"), eq("user-id"), anyString());
    }

    @Test
    void replyAsUserTicketClosed() {
        SupportTicket ticket = new SupportTicket(
                "t1", "user-id", "test@test.com", "Subject", "Message", "bug", "closed", "token", 1L, Instant.now());
        when(supportTicketRepository.getTicketByToken("token")).thenReturn(Optional.of(ticket));

        var outcome = service.replyAsUser("token", "Reply", "host");
        assertEquals(SupportTicketUseCase.ReplyOutcome.TICKET_CLOSED, outcome);
    }

    @Test
    void replyAsUserOk() {
        SupportTicket ticket = new SupportTicket(
                "t1", "user-id", "test@test.com", "Subject", "Message", "bug", "open", "token", 1L, Instant.now());
        when(supportTicketRepository.getTicketByToken("token")).thenReturn(Optional.of(ticket));
        when(supportTicketRepository.isReplyOnCooldown("t1")).thenReturn(false);

        var outcome = service.replyAsUser("token", "Reply", "host");
        assertEquals(SupportTicketUseCase.ReplyOutcome.OK, outcome);
        verify(supportTicketRepository).addReply("t1", "user", "Reply");
        verify(mailer).sendSupportTicketUserReply(eq(1L), eq("test@test.com"), eq("Subject"), eq("Reply"), anyString());
    }
}