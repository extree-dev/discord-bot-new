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
import tech.extree.stats.application.port.in.SupportTicketUseCase.CreateOutcome;
import tech.extree.stats.application.port.in.SupportTicketUseCase.CreateResult;
import tech.extree.stats.application.port.in.SupportTicketUseCase.PublicTicketResult;
import tech.extree.stats.application.port.in.SupportTicketUseCase.ReplyOutcome;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.SupportTicketRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.User;

@ExtendWith(MockitoExtension.class)
class SupportTicketServiceTest {

    private static final String EMAIL = "player@example.com";
    private static final String HOST = "stats.extree.tech";
    private static final String COOKIE = "encrypted-cookie";

    @Mock private SessionCodec sessionCodec;
    @Mock private UserRepository userRepository;
    @Mock private SupportTicketRepository supportTicketRepository;
    @Mock private Mailer mailer;

    private SupportTicketService service;

    @BeforeEach
    void setUp() {
        service = new SupportTicketService(sessionCodec, userRepository, supportTicketRepository, mailer);
    }

    @Test
    void createTicketWithoutSessionRequiresValidEmail() {
        CreateResult result = service.createTicket(null, "not-an-email", "Help", "Something broke", "bug", HOST);

        assertThat(result.outcome()).isEqualTo(CreateOutcome.INVALID_EMAIL);
        verify(supportTicketRepository, never()).createTicket(any(), any(), any(), any(), any());
    }

    @Test
    void createTicketValidatesSubjectMessageCategoryInOrder() {
        assertThat(service.createTicket(null, EMAIL, "", "msg", "bug", HOST).outcome()).isEqualTo(CreateOutcome.INVALID_SUBJECT);
        assertThat(service.createTicket(null, EMAIL, "Subject", "", "bug", HOST).outcome()).isEqualTo(CreateOutcome.INVALID_MESSAGE);
        assertThat(service.createTicket(null, EMAIL, "Subject", "msg", "not-a-category", HOST).outcome())
                .isEqualTo(CreateOutcome.INVALID_CATEGORY);
    }

    @Test
    void createTicketRespectsCooldown() {
        when(supportTicketRepository.isOnCooldown(EMAIL)).thenReturn(true);

        assertThat(service.createTicket(null, EMAIL, "Subject", "msg", "bug", HOST).outcome())
                .isEqualTo(CreateOutcome.CODE_ON_COOLDOWN);
    }

    @Test
    void createTicketUsesSessionEmailAndIgnoresBodyEmail() {
        when(sessionCodec.decrypt(COOKIE)).thenReturn(Optional.of(new Session(null, "user-1", 1L)));
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user()));
        when(supportTicketRepository.isOnCooldown(EMAIL)).thenReturn(false);
        when(supportTicketRepository.createTicket("user-1", EMAIL, "Subject", "msg", "bug"))
                .thenReturn(new SupportTicket("t1", "user-1", EMAIL, "Subject", "msg", "bug", "open", "viewtok", 42, Instant.now()));

        CreateResult result = service.createTicket(COOKIE, "someone-else@example.com", "Subject", "msg", "bug", HOST);

        assertThat(result.outcome()).isEqualTo(CreateOutcome.OK);
        assertThat(result.ticketNumber()).isEqualTo(42L);
        verify(supportTicketRepository).createTicket("user-1", EMAIL, "Subject", "msg", "bug");
        verify(mailer).sendSupportTicketConfirmation(eq(EMAIL), eq(42L), eq("Subject"), any());
    }

    @Test
    void createTicketSurvivesInternalNotificationFailure() {
        when(supportTicketRepository.isOnCooldown(EMAIL)).thenReturn(false);
        when(supportTicketRepository.createTicket(null, EMAIL, "Subject", "msg", "bug"))
                .thenReturn(new SupportTicket("t1", null, EMAIL, "Subject", "msg", "bug", "open", "viewtok", 7, Instant.now()));
        org.mockito.Mockito.doThrow(new RuntimeException("smtp down"))
                .when(mailer)
                .sendSupportTicketNotification(any(Long.class), any(), any(), any(), any(), any(), any());

        CreateResult result = service.createTicket(null, EMAIL, "Subject", "msg", "bug", HOST);

        assertThat(result.outcome()).isEqualTo(CreateOutcome.OK);
    }

    @Test
    void getTicketByTokenReturnsEmptyWhenNotFound() {
        when(supportTicketRepository.getTicketByToken("nope")).thenReturn(Optional.empty());

        assertThat(service.getTicketByToken("nope")).isEmpty();
    }

    @Test
    void getTicketByTokenOmitsEmailFromPublicView() {
        when(supportTicketRepository.getTicketByToken("tok"))
                .thenReturn(Optional.of(new SupportTicket("t1", null, EMAIL, "Subject", "msg", "bug", "open", "tok", 5, Instant.now())));
        when(supportTicketRepository.listReplies("t1")).thenReturn(List.of());

        Optional<PublicTicketResult> result = service.getTicketByToken("tok");

        assertThat(result).isPresent();
        assertThat(result.get().ticket().number()).isEqualTo(5L);
        assertThat(result.get().ticket().subject()).isEqualTo("Subject");
    }

    @Test
    void replyAsUserRejectsClosedTicket() {
        when(supportTicketRepository.getTicketByToken("tok"))
                .thenReturn(Optional.of(new SupportTicket("t1", null, EMAIL, "Subject", "msg", "bug", "closed", "tok", 5, Instant.now())));

        assertThat(service.replyAsUser("tok", "more info", HOST)).isEqualTo(ReplyOutcome.TICKET_CLOSED);
        verify(supportTicketRepository, never()).addReply(any(), any(), any());
    }

    @Test
    void replyAsUserRespectsCooldown() {
        when(supportTicketRepository.getTicketByToken("tok"))
                .thenReturn(Optional.of(new SupportTicket("t1", null, EMAIL, "Subject", "msg", "bug", "open", "tok", 5, Instant.now())));
        when(supportTicketRepository.isReplyOnCooldown("t1")).thenReturn(true);

        assertThat(service.replyAsUser("tok", "more info", HOST)).isEqualTo(ReplyOutcome.CODE_ON_COOLDOWN);
    }

    @Test
    void replyAsUserSucceedsAndNotifiesSupport() {
        when(supportTicketRepository.getTicketByToken("tok"))
                .thenReturn(Optional.of(new SupportTicket("t1", null, EMAIL, "Subject", "msg", "bug", "open", "tok", 5, Instant.now())));
        when(supportTicketRepository.isReplyOnCooldown("t1")).thenReturn(false);

        assertThat(service.replyAsUser("tok", "more info", HOST)).isEqualTo(ReplyOutcome.OK);
        verify(supportTicketRepository).addReply("t1", "user", "more info");
        verify(mailer).sendSupportTicketUserReply(eq(5L), eq(EMAIL), eq("Subject"), eq("more info"), any());
    }

    private static User user() {
        return new User("user-1", EMAIL, "hash", Instant.now(), null, "Player", "player_one");
    }
}
