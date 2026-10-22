package tech.extree.stats.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tech.extree.stats.application.port.in.AdminTicketUseCase;
import tech.extree.stats.application.port.out.CannedResponseRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.SupportTicketRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.User;

class AdminTicketServiceTest {

    private UserRepository userRepository;
    private SupportAdminEmails supportAdminEmails;
    private SupportTicketRepository supportTicketRepository;
    private CannedResponseRepository cannedResponseRepository;
    private Mailer mailer;
    private AdminTicketService service;

    // 11 аргументов
    private final User admin = new User(
            "admin-id", "admin@test.com", "hash", Instant.now(), null, "Admin", "admin", null, false, false, false);
    private final User user = new User(
            "user-id", "user@test.com", "hash", Instant.now(), null, "User", "user", null, false, false, false);

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        supportAdminEmails = mock(SupportAdminEmails.class);
        supportTicketRepository = mock(SupportTicketRepository.class);
        cannedResponseRepository = mock(CannedResponseRepository.class);
        mailer = mock(Mailer.class);
        SessionCodec sessionCodec = mock(SessionCodec.class);

        when(sessionCodec.decrypt("admin-cookie"))
                .thenReturn(Optional.of(new Session(null, "admin-id", 0)));
        when(sessionCodec.decrypt("user-cookie"))
                .thenReturn(Optional.of(new Session(null, "user-id", 0)));
        
        when(userRepository.findById("admin-id")).thenReturn(Optional.of(admin));
        when(userRepository.findById("user-id")).thenReturn(Optional.of(user));
        
        when(supportAdminEmails.isAdmin(admin)).thenReturn(true);
        when(supportAdminEmails.isAdmin(user)).thenReturn(false);

        service = new AdminTicketService(
                sessionCodec, userRepository, supportAdminEmails,
                supportTicketRepository, cannedResponseRepository, mailer);
    }

    @Test
    void listTicketsRequiresAuth() {
        var result = service.listTickets(null, null);
        assertEquals(AdminTicketUseCase.ListOutcome.UNAUTHORIZED, result.outcome());
    }

    @Test
    void listTicketsRequiresAdmin() {
        var result = service.listTickets("user-cookie", null);
        assertEquals(AdminTicketUseCase.ListOutcome.FORBIDDEN, result.outcome());
    }

    @Test
    void listTicketsOk() {
        when(supportTicketRepository.listTickets(any())).thenReturn(List.of());
        var result = service.listTickets("admin-cookie", null);
        assertEquals(AdminTicketUseCase.ListOutcome.OK, result.outcome());
        assertTrue(result.tickets().isEmpty());
    }

    @Test
    void getTicketNotFound() {
        when(supportTicketRepository.getTicketByNumber(1L)).thenReturn(Optional.empty());
        var result = service.getTicket("admin-cookie", "1");
        assertEquals(AdminTicketUseCase.DetailOutcome.TICKET_NOT_FOUND, result.outcome());
    }

    @Test
    void replyOk() {
        SupportTicket ticket = new SupportTicket(
                "t1", "user-id", "user@test.com", "sub", "msg", "bug", "open", "token", 1L, Instant.now());
        when(supportTicketRepository.getTicketByNumber(1L)).thenReturn(Optional.of(ticket));

        var result = service.reply("admin-cookie", "1", "reply text", "host");
        assertEquals(AdminTicketUseCase.ReplyOutcome.OK, result);
        verify(supportTicketRepository).addReply(eq("t1"), eq("admin"), eq("reply text"));
        verify(supportTicketRepository).setStatus("t1", "in_progress");
        verify(mailer).sendSupportTicketReply(anyString(), eq(1L), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void replySkipsStatusChangeIfNotOpen() {
        SupportTicket ticket = new SupportTicket(
                "t1", "user-id", "user@test.com", "sub", "msg", "bug", "in_progress", "token", 1L, Instant.now());
        when(supportTicketRepository.getTicketByNumber(1L)).thenReturn(Optional.of(ticket));

        service.reply("admin-cookie", "1", "reply text", "host");
        verify(supportTicketRepository, never()).setStatus(anyString(), anyString());
    }
}