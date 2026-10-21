package tech.extree.stats.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
import tech.extree.stats.application.port.in.AccountSettingsUseCase.ChangeEmailOutcome;
import tech.extree.stats.application.port.in.AccountSettingsUseCase.ChangePasswordOutcome;
import tech.extree.stats.application.port.in.AccountSettingsUseCase.ConfirmEmailChangeOutcome;
import tech.extree.stats.application.port.in.AccountSettingsUseCase.ConfirmEmailChangeResult;
import tech.extree.stats.application.port.in.AccountSettingsUseCase.LoginHistoryOutcome;
import tech.extree.stats.application.port.in.AccountSettingsUseCase.LoginHistoryResult;
import tech.extree.stats.application.port.in.AccountSettingsUseCase.ResendEmailChangeCodeOutcome;
import tech.extree.stats.application.port.out.EmailChangeCodeRepository;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.application.port.out.LoginEventRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.EmailChangeCode;
import tech.extree.stats.domain.Location;
import tech.extree.stats.domain.LoginEvent;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

@ExtendWith(MockitoExtension.class)
class AccountSettingsServiceTest {

    private static final String EMAIL = "player@example.com";
    private static final String NEW_EMAIL = "newmail@example.com";
    private static final String COOKIE = "encrypted-cookie";
    private static final String USER_ID = "user-1";
    private static final String IP = "203.0.113.7";

    @Mock private SessionCodec sessionCodec;
    @Mock private UserRepository userRepository;
    @Mock private PasswordHasher passwordHasher;
    @Mock private EmailChangeCodeRepository emailChangeCodeRepository;
    @Mock private LoginEventRepository loginEventRepository;
    @Mock private GeoLookup geoLookup;
    @Mock private Mailer mailer;

    private AccountSettingsService service;

    @BeforeEach
    void setUp() {
        service = new AccountSettingsService(
                sessionCodec, userRepository, passwordHasher, emailChangeCodeRepository, loginEventRepository, geoLookup, mailer);
    }

    private void authenticated() {
        when(sessionCodec.decrypt(COOKIE)).thenReturn(Optional.of(new Session(null, USER_ID, 1L)));
    }

    @Test
    void changeEmailRequiresSession() {
        when(sessionCodec.decrypt(COOKIE)).thenReturn(Optional.empty());

        assertThat(service.changeEmail(COOKIE, "pw", NEW_EMAIL)).isEqualTo(ChangeEmailOutcome.UNAUTHORIZED);
        verify(userRepository, never()).findById(any());
    }

    @Test
    void changeEmailTreatsNullCookieAsUnauthenticated() {
        assertThat(service.changeEmail(null, "pw", NEW_EMAIL)).isEqualTo(ChangeEmailOutcome.UNAUTHORIZED);
    }

    @Test
    void changeEmailRejectsWrongPassword() {
        authenticated();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(EMAIL)));
        when(passwordHasher.verify("wrong", "hash")).thenReturn(false);

        assertThat(service.changeEmail(COOKIE, "wrong", NEW_EMAIL)).isEqualTo(ChangeEmailOutcome.WRONG_PASSWORD);
    }

    @Test
    void changeEmailRejectsSameEmail() {
        authenticated();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(EMAIL)));
        when(passwordHasher.verify("pw", "hash")).thenReturn(true);

        assertThat(service.changeEmail(COOKIE, "pw", EMAIL)).isEqualTo(ChangeEmailOutcome.SAME_EMAIL);
    }

    @Test
    void changeEmailRejectsAlreadyRegisteredEmail() {
        authenticated();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(EMAIL)));
        when(passwordHasher.verify("pw", "hash")).thenReturn(true);
        when(userRepository.findByEmail(NEW_EMAIL)).thenReturn(Optional.of(user(NEW_EMAIL)));

        assertThat(service.changeEmail(COOKIE, "pw", NEW_EMAIL)).isEqualTo(ChangeEmailOutcome.EMAIL_ALREADY_REGISTERED);
    }

    @Test
    void changeEmailSendsCodeAndNoticeOnSuccess() {
        authenticated();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(EMAIL)));
        when(passwordHasher.verify("pw", "hash")).thenReturn(true);
        when(userRepository.findByEmail(NEW_EMAIL)).thenReturn(Optional.empty());
        when(emailChangeCodeRepository.getCode(USER_ID)).thenReturn(Optional.empty());

        assertThat(service.changeEmail(COOKIE, "pw", NEW_EMAIL)).isEqualTo(ChangeEmailOutcome.OK);
        verify(emailChangeCodeRepository).upsertCode(eq(USER_ID), eq(NEW_EMAIL), anyString(), any());
        verify(mailer).sendEmailChangeCode(eq(NEW_EMAIL), anyString());
        verify(mailer).sendEmailChangeNotice(eq(EMAIL), eq(NEW_EMAIL));
    }

    @Test
    void changeEmailSurvivesNoticeFailure() {
        authenticated();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(EMAIL)));
        when(passwordHasher.verify("pw", "hash")).thenReturn(true);
        when(userRepository.findByEmail(NEW_EMAIL)).thenReturn(Optional.empty());
        when(emailChangeCodeRepository.getCode(USER_ID)).thenReturn(Optional.empty());
        org.mockito.Mockito.doThrow(new RuntimeException("smtp down")).when(mailer).sendEmailChangeNotice(any(), any());

        assertThat(service.changeEmail(COOKIE, "pw", NEW_EMAIL)).isEqualTo(ChangeEmailOutcome.OK);
    }

    @Test
    void resendEmailChangeCodeRequiresPendingChange() {
        authenticated();
        when(emailChangeCodeRepository.getCode(USER_ID)).thenReturn(Optional.empty());

        assertThat(service.resendEmailChangeCode(COOKIE)).isEqualTo(ResendEmailChangeCodeOutcome.NO_PENDING_CHANGE);
    }

    @Test
    void confirmEmailChangeRejectsWrongCode() {
        authenticated();
        when(emailChangeCodeRepository.getCode(USER_ID))
                .thenReturn(Optional.of(new EmailChangeCode(NEW_EMAIL, "123456", 0, Instant.now().plusSeconds(600), Instant.now())));

        ConfirmEmailChangeResult result = service.confirmEmailChange(COOKIE, "000000");

        assertThat(result.outcome()).isEqualTo(ConfirmEmailChangeOutcome.WRONG_CODE);
        verify(emailChangeCodeRepository).registerFailedAttempt(USER_ID);
    }

    @Test
    void confirmEmailChangeRecheckConflictBeforeApplying() {
        authenticated();
        when(emailChangeCodeRepository.getCode(USER_ID))
                .thenReturn(Optional.of(new EmailChangeCode(NEW_EMAIL, "123456", 0, Instant.now().plusSeconds(600), Instant.now())));
        when(userRepository.findByEmail(NEW_EMAIL)).thenReturn(Optional.of(new User("someone-else", NEW_EMAIL, "h", null, null, null, null)));

        ConfirmEmailChangeResult result = service.confirmEmailChange(COOKIE, "123456");

        assertThat(result.outcome()).isEqualTo(ConfirmEmailChangeOutcome.EMAIL_ALREADY_REGISTERED);
        verify(emailChangeCodeRepository).deleteCode(USER_ID);
        verify(userRepository, never()).updateEmail(any(), any());
    }

    @Test
    void confirmEmailChangeAppliesAndNotifiesBothAddresses() {
        authenticated();
        when(emailChangeCodeRepository.getCode(USER_ID))
                .thenReturn(Optional.of(new EmailChangeCode(NEW_EMAIL, "123456", 0, Instant.now().plusSeconds(600), Instant.now())));
        when(userRepository.findByEmail(NEW_EMAIL)).thenReturn(Optional.empty());
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(EMAIL)));
        when(userRepository.updateEmail(USER_ID, NEW_EMAIL)).thenReturn(Optional.of(user(NEW_EMAIL)));

        ConfirmEmailChangeResult result = service.confirmEmailChange(COOKIE, "123456");

        assertThat(result.outcome()).isEqualTo(ConfirmEmailChangeOutcome.OK);
        assertThat(result.email()).isEqualTo(NEW_EMAIL);
        verify(mailer).sendEmailChanged(EMAIL, EMAIL, NEW_EMAIL);
        verify(mailer).sendEmailChanged(NEW_EMAIL, EMAIL, NEW_EMAIL);
        verify(emailChangeCodeRepository).deleteCode(USER_ID);
    }

    @Test
    void changePasswordRejectsWrongCurrentPassword() {
        authenticated();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(EMAIL)));
        when(passwordHasher.verify("wrong", "hash")).thenReturn(false);

        assertThat(service.changePassword(COOKIE, "wrong", "CorrectHorseBattery9", IP))
                .isEqualTo(ChangePasswordOutcome.WRONG_PASSWORD);
    }

    @Test
    void changePasswordSucceedsAndNotifies() {
        authenticated();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(EMAIL)));
        when(passwordHasher.verify("pw", "hash")).thenReturn(true);
        when(passwordHasher.hash("CorrectHorseBattery9")).thenReturn("newhash");
        when(userRepository.updatePasswordHash(USER_ID, "newhash")).thenReturn(Optional.of(user(EMAIL)));
        when(geoLookup.lookup(IP)).thenReturn(new Location("US", "NYC"));

        assertThat(service.changePassword(COOKIE, "pw", "CorrectHorseBattery9", IP)).isEqualTo(ChangePasswordOutcome.OK);
        verify(mailer).sendPasswordChanged(eq(EMAIL), eq(IP), eq("US"), eq("NYC"), anyString());
    }

    @Test
    void loginHistoryRequiresSession() {
        when(sessionCodec.decrypt(COOKIE)).thenReturn(Optional.empty());

        LoginHistoryResult result = service.loginHistory(COOKIE);

        assertThat(result.outcome()).isEqualTo(LoginHistoryOutcome.UNAUTHORIZED);
        assertThat(result.events()).isEmpty();
    }

    @Test
    void loginHistoryMapsEventsToViews() {
        authenticated();
        Instant createdAt = Instant.parse("2026-01-01T12:00:00Z");
        when(loginEventRepository.listRecent(USER_ID, 10))
                .thenReturn(List.of(new LoginEvent("evt-1", IP, "US", "NYC", createdAt)));

        LoginHistoryResult result = service.loginHistory(COOKIE);

        assertThat(result.outcome()).isEqualTo(LoginHistoryOutcome.OK);
        assertThat(result.events()).hasSize(1);
        assertThat(result.events().get(0).id()).isEqualTo("evt-1");
        assertThat(result.events().get(0).country()).isEqualTo("US");
    }

    private static User user(String email) {
        return new User(USER_ID, email, "hash", Instant.now(), null, "Player", "player_one");
    }
}
