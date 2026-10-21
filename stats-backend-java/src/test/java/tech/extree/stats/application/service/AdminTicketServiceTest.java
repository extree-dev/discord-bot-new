package tech.extree.stats.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tech.extree.stats.application.port.in.AdminTicketUseCase.CannedCreateOutcome;
import tech.extree.stats.application.port.in.AdminTicketUseCase.DetailOutcome;
import tech.extree.stats.application.port.in.AdminTicketUseCase.ListOutcome;
import tech.extree.stats.application.port.in.AdminTicketUseCase.ReplyOutcome;
import tech.extree.stats.application.port.in.AdminTicketUseCase.StatusOutcome;
import tech.extree.stats.application.port.out.CannedResponseRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.SupportTicketRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.User;

@ExtendWith(MockitoExtension.class)
class AdminTicketServiceTest {

    private static final String ADMIN_EMAIL = "admin@example.com";
    private static final String PLAIN_EMAIL = "player@example.com";
    private static final String COOKIE = "encrypted-cookie";
    private static final String ADMIN_ID = "admin-1";
    private static final String PLAIN_ID = "user-1";

    @Mock private SessionCodec sessionCodec;
    @Mock private UserRepository userRepository;
    @Mock private SupportTicketRepository supportTicketRepository;
    @Mock private CannedResponseRepository cannedResponseRepository;
    @Mock private Mailer mailer;

    private AdminTicketService service;

    @BeforeEach
    void setUp() {
        SupportAdminEmails supportAdminEmails = new SupportAdminEmails(ADMIN_EMAIL);
        service = new AdminTicketService(
                sessionCodec, userRepository, supportAdminEmails, supportTicketRepository, cannedResponseRepository, mailer);
    }

    private void asAdmin() {
        when(sessionCodec.decrypt(COOKIE)).thenReturn(Optional.of(new Session(null, ADMIN_ID, 1L)));
        when(userRepository.findById(ADMIN_ID)).thenReturn(Optional.of(new User(ADMIN_ID, ADMIN_EMAIL, "h", Instant.now(), null, "Admin", "admin")));
    }

    private void asNonAdmin() {
        when(sessionCodec.decrypt(COOKIE)).thenReturn(Optional.of(new Session(null, PLAIN_ID, 1L)));
        when(userRepository.findById(PLAIN_ID)).thenReturn(Optional.of(new User(PLAIN_ID, PLAIN_EMAIL, "h", Instant.now(), null, "Player", "player")));
    }

    @Test
    void listTicketsRequiresSession() {
        when(sessionCodec.decrypt(COOKIE)).thenReturn(Optional.empty());

        assertThat(service.listTickets(COOKIE, null).outcome()).isEqualTo(ListOutcome.UNAUTHORIZED);
    }

    @Test
    void listTicketsRejectsNonAdmin() {
        asNonAdmin();

        assertThat(service.listTickets(COOKIE, null).outcome()).isEqualTo(ListOutcome.FORBIDDEN);
    }

    @Test
    void listTicketsRejectsInvalidStatus() {
        asAdmin();

        assertThat(service.listTickets(COOKIE, "bogus").outcome()).isEqualTo(ListOutcome.INVALID_REQUEST);
    }

    @Test
    void listTicketsReturnsSummaries() {
        asAdmin();
        when(supportTicketRepository.listTickets(null))
                .thenReturn(List.of(new SupportTicket(null, null, PLAIN_EMAIL, "Subject", null, "bug", "open", null, 1, Instant.now())));

        var result = service.listTickets(COOKIE, null);

        assertThat(result.outcome()).isEqualTo(ListOutcome.OK);
        assertThat(result.tickets()).hasSize(1);
        assertThat(result.tickets().get(0).number()).isEqualTo(1L);
    }

    @Test
    void getTicketRejectsNonNumericTicketNumberAsNotFound() {
        asAdmin();

        assertThat(service.getTicket(COOKIE, "not-a-number").outcome()).isEqualTo(DetailOutcome.TICKET_NOT_FOUND);
        verify(supportTicketRepository, never()).getTicketByNumber(org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void getTicketReturnsNotFoundWhenMissing() {
        asAdmin();
        when(supportTicketRepository.getTicketByNumber(99)).thenReturn(Optional.empty());

        assertThat(service.getTicket(COOKIE, "99").outcome()).isEqualTo(DetailOutcome.TICKET_NOT_FOUND);
    }

    @Test
    void replyAdvancesOpenTicketToInProgress() {
        asAdmin();
        SupportTicket ticket = new SupportTicket("t1", null, PLAIN_EMAIL, "Subject", "msg", "bug", "open", "tok", 5, Instant.now());
        when(supportTicketRepository.getTicketByNumber(5)).thenReturn(Optional.of(ticket));

        assertThat(service.reply(COOKIE, "5", "We're on it", "stats.extree.tech")).isEqualTo(ReplyOutcome.OK);
        verify(supportTicketRepository).addReply("t1", "admin", "We're on it");
        verify(supportTicketRepository).setStatus("t1", "in_progress");
        verify(mailer).sendSupportTicketReply(eq(PLAIN_EMAIL), eq(5L), eq("Subject"), eq("We're on it"), eq("Admin"), any());
    }

    @Test
    void replyDoesNotOverrideAlreadyAdvancedStatus() {
        asAdmin();
        SupportTicket ticket = new SupportTicket("t1", null, PLAIN_EMAIL, "Subject", "msg", "bug", "closed", "tok", 5, Instant.now());
        when(supportTicketRepository.getTicketByNumber(5)).thenReturn(Optional.of(ticket));

        assertThat(service.reply(COOKIE, "5", "Follow-up", "stats.extree.tech")).isEqualTo(ReplyOutcome.OK);
        verify(supportTicketRepository, never()).setStatus(any(), any());
    }

    @Test
    void replyFallsBackToSupportWhenAdminNameBlank() {
        when(sessionCodec.decrypt(COOKIE)).thenReturn(Optional.of(new Session(null, ADMIN_ID, 1L)));
        when(userRepository.findById(ADMIN_ID)).thenReturn(Optional.of(new User(ADMIN_ID, ADMIN_EMAIL, "h", Instant.now(), null, "", "admin")));
        SupportTicket ticket = new SupportTicket("t1", null, PLAIN_EMAIL, "Subject", "msg", "bug", "open", "tok", 5, Instant.now());
        when(supportTicketRepository.getTicketByNumber(5)).thenReturn(Optional.of(ticket));

        assertThat(service.reply(COOKIE, "5", "We're on it", "stats.extree.tech")).isEqualTo(ReplyOutcome.OK);
        verify(mailer).sendSupportTicketReply(eq(PLAIN_EMAIL), eq(5L), eq("Subject"), eq("We're on it"), eq("Support"), any());
    }

    @Test
    void setStatusRejectsInvalidValue() {
        asAdmin();

        assertThat(service.setStatus(COOKIE, "5", "bogus")).isEqualTo(StatusOutcome.INVALID_REQUEST);
    }

    @Test
    void createCannedResponseValidatesFields() {
        asAdmin();

        assertThat(service.createCannedResponse(COOKIE, "", "body").outcome()).isEqualTo(CannedCreateOutcome.INVALID_SUBJECT);
        assertThat(service.createCannedResponse(COOKIE, "title", "").outcome()).isEqualTo(CannedCreateOutcome.INVALID_MESSAGE);
    }

    @Test
    void createCannedResponseSucceeds() {
        asAdmin();
        when(cannedResponseRepository.create("Title", "Body")).thenReturn("canned-1");

        var result = service.createCannedResponse(COOKIE, "Title", "Body");

        assertThat(result.outcome()).isEqualTo(CannedCreateOutcome.OK);
        assertThat(result.id()).isEqualTo("canned-1");
    }
}
