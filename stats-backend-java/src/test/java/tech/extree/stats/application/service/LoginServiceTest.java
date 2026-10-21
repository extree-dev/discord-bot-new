package tech.extree.stats.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tech.extree.stats.application.port.in.LoginUseCase.ConfirmLocationOutcome;
import tech.extree.stats.application.port.in.LoginUseCase.ConfirmLocationResult;
import tech.extree.stats.application.port.in.LoginUseCase.LoginOutcome;
import tech.extree.stats.application.port.in.LoginUseCase.LoginResult;
import tech.extree.stats.application.port.in.LoginUseCase.ResendLoginCodeOutcome;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.application.port.out.LoginCodeRepository;
import tech.extree.stats.application.port.out.LoginEventRepository;
import tech.extree.stats.application.port.out.LoginLocationRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.TurnstileVerifier;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Location;
import tech.extree.stats.domain.LoginCode;
import tech.extree.stats.domain.User;

/**
 * Проверяет порядок проверок и error-коды /auth/login,
 * /auth/login/resend-code, /auth/login/confirm-location из server.js
 * (Node) — см. комментарий в LoginService. Выходные порты замоканы.
 */
@ExtendWith(MockitoExtension.class)
class LoginServiceTest {

    private static final String EMAIL = "player@example.com";
    private static final String PASSWORD = "CorrectHorseBattery9";
    private static final String IP = "203.0.113.7";

    @Mock private UserRepository userRepository;
    @Mock private PasswordHasher passwordHasher;
    @Mock private TurnstileVerifier turnstileVerifier;
    @Mock private GeoLookup geoLookup;
    @Mock private LoginLocationRepository loginLocationRepository;
    @Mock private LoginEventRepository loginEventRepository;
    @Mock private LoginCodeRepository loginCodeRepository;
    @Mock private Mailer mailer;
    @Mock private SessionCodec sessionCodec;

    private LoginService service;

    @BeforeEach
    void setUp() {
        service = new LoginService(
                userRepository,
                passwordHasher,
                turnstileVerifier,
                geoLookup,
                loginLocationRepository,
                loginEventRepository,
                loginCodeRepository,
                mailer,
                sessionCodec);
    }

    @Test
    void rejectsWhenTurnstileFailsBeforeTouchingAnythingElse() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(false);

        LoginResult result = service.login(EMAIL, PASSWORD, "bad-token", IP, true);

        assertThat(result.outcome()).isEqualTo(LoginOutcome.TURNSTILE_FAILED);
        verify(userRepository, never()).findByEmail(any());
    }

    @Test
    void rejectsInvalidRequestShape() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(true);

        assertThat(service.login("not-an-email", PASSWORD, "token", IP, true).outcome())
                .isEqualTo(LoginOutcome.INVALID_REQUEST);
        assertThat(service.login(EMAIL, null, "token", IP, true).outcome()).isEqualTo(LoginOutcome.INVALID_REQUEST);
    }

    @Test
    void rejectsWrongPasswordOrUnknownEmailWithTheSameOutcome() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThat(service.login(EMAIL, PASSWORD, "token", IP, true).outcome())
                .isEqualTo(LoginOutcome.INVALID_CREDENTIALS);
    }

    @Test
    void rejectsUnverifiedEmail() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(unverifiedUser()));
        when(passwordHasher.verify(PASSWORD, "hash")).thenReturn(true);

        assertThat(service.login(EMAIL, PASSWORD, "token", IP, true).outcome())
                .isEqualTo(LoginOutcome.EMAIL_NOT_VERIFIED);
    }

    @Test
    void issuesLoginCodeForUnknownLocationWhenAccountHasHistory() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));
        when(passwordHasher.verify(PASSWORD, "hash")).thenReturn(true);
        when(geoLookup.lookup(IP)).thenReturn(new Location("FR", "Paris"));
        when(loginLocationRepository.hasAnyKnownLocation("user-1")).thenReturn(true);
        when(loginLocationRepository.isKnownLocation("user-1", "FR")).thenReturn(false);
        when(loginCodeRepository.getCode(EMAIL)).thenReturn(Optional.empty());

        LoginResult result = service.login(EMAIL, PASSWORD, "token", IP, true);

        assertThat(result.outcome()).isEqualTo(LoginOutcome.UNKNOWN_LOCATION);
        verify(loginCodeRepository).upsertCode(eq(EMAIL), anyString(), eq(IP), eq("FR"), eq("Paris"), eq(true), any());
        verify(mailer).sendNewLocationCode(eq(EMAIL), anyString(), eq(IP), eq("FR"), eq("Paris"));
        verify(sessionCodec, never()).encrypt(any());
    }

    @Test
    void respectsCooldownForUnknownLocationCode() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));
        when(passwordHasher.verify(PASSWORD, "hash")).thenReturn(true);
        when(geoLookup.lookup(IP)).thenReturn(new Location("FR", "Paris"));
        when(loginLocationRepository.hasAnyKnownLocation("user-1")).thenReturn(true);
        when(loginLocationRepository.isKnownLocation("user-1", "FR")).thenReturn(false);
        when(loginCodeRepository.getCode(EMAIL)).thenReturn(Optional.of(freshLoginCode()));

        assertThat(service.login(EMAIL, PASSWORD, "token", IP, true).outcome())
                .isEqualTo(LoginOutcome.CODE_ON_COOLDOWN);
    }

    @Test
    void logsInDirectlyWhenLocationIsKnown() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));
        when(passwordHasher.verify(PASSWORD, "hash")).thenReturn(true);
        when(geoLookup.lookup(IP)).thenReturn(new Location("US", "NYC"));
        when(loginLocationRepository.hasAnyKnownLocation("user-1")).thenReturn(true);
        when(loginLocationRepository.isKnownLocation("user-1", "US")).thenReturn(true);
        when(sessionCodec.encrypt(any())).thenReturn("token-abc");

        LoginResult result = service.login(EMAIL, PASSWORD, "token", IP, true);

        assertThat(result.outcome()).isEqualTo(LoginOutcome.OK);
        assertThat(result.sessionCookie()).isEqualTo("token-abc");
        verify(loginLocationRepository).rememberLocation("user-1", "US", "NYC", IP);
        verify(loginEventRepository).recordLogin("user-1", IP, "US", "NYC");
    }

    @Test
    void logsInDirectlyWhenAccountHasNoHistoryYet() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));
        when(passwordHasher.verify(PASSWORD, "hash")).thenReturn(true);
        when(geoLookup.lookup(IP)).thenReturn(new Location("FR", "Paris"));
        when(loginLocationRepository.hasAnyKnownLocation("user-1")).thenReturn(false);
        when(sessionCodec.encrypt(any())).thenReturn("token-abc");

        assertThat(service.login(EMAIL, PASSWORD, "token", IP, true).outcome()).isEqualTo(LoginOutcome.OK);
    }

    @Test
    void loginSurvivesANotificationEmailFailure() {
        when(turnstileVerifier.verify(any(), any())).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));
        when(passwordHasher.verify(PASSWORD, "hash")).thenReturn(true);
        when(geoLookup.lookup(IP)).thenReturn(new Location("US", "NYC"));
        when(loginLocationRepository.hasAnyKnownLocation("user-1")).thenReturn(true);
        when(loginLocationRepository.isKnownLocation("user-1", "US")).thenReturn(true);
        org.mockito.Mockito.doThrow(new RuntimeException("smtp down"))
                .when(mailer)
                .sendSignInNotification(any(), any(), any(), any(), any());
        when(sessionCodec.encrypt(any())).thenReturn("token-abc");

        assertThat(service.login(EMAIL, PASSWORD, "token", IP, true).outcome()).isEqualTo(LoginOutcome.OK);
    }

    @Test
    void resendCodeDoesNotRevealWhetherALoginIsPending() {
        when(loginCodeRepository.getCode(EMAIL)).thenReturn(Optional.empty());

        assertThat(service.resendCode(EMAIL)).isEqualTo(ResendLoginCodeOutcome.OK);
        verify(mailer, never()).sendNewLocationCode(any(), any(), any(), any(), any());
    }

    @Test
    void resendCodeRespectsCooldown() {
        when(loginCodeRepository.getCode(EMAIL)).thenReturn(Optional.of(freshLoginCode()));

        assertThat(service.resendCode(EMAIL)).isEqualTo(ResendLoginCodeOutcome.CODE_ON_COOLDOWN);
    }

    @Test
    void confirmLocationRejectsWrongCode() {
        when(loginCodeRepository.getCode(EMAIL)).thenReturn(Optional.of(freshLoginCode()));

        ConfirmLocationResult result = service.confirmLocation(EMAIL, "000000");

        assertThat(result.outcome()).isEqualTo(ConfirmLocationOutcome.WRONG_CODE);
        verify(loginCodeRepository).registerFailedAttempt(EMAIL);
    }

    @Test
    void confirmLocationTrustsTheStoredRowNotTheCurrentRequest() {
        when(loginCodeRepository.getCode(EMAIL))
                .thenReturn(Optional.of(new LoginCode(
                        "123456", 0, "198.51.100.9", "DE", "Berlin", false, Instant.now().plusSeconds(600), Instant.now())));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));
        when(sessionCodec.encrypt(any())).thenReturn("token-xyz");

        ConfirmLocationResult result = service.confirmLocation(EMAIL, "123456");

        assertThat(result.outcome()).isEqualTo(ConfirmLocationOutcome.OK);
        assertThat(result.remember()).isFalse();
        verify(loginLocationRepository).rememberLocation("user-1", "DE", "Berlin", "198.51.100.9");
        verify(loginEventRepository).recordLogin("user-1", "198.51.100.9", "DE", "Berlin");
        verify(loginCodeRepository).deleteCode(EMAIL);
    }

    private static User verifiedUser() {
        return new User("user-1", EMAIL, "hash", Instant.now(), null, "Player", "player_one");
    }

    private static User unverifiedUser() {
        return new User("user-1", EMAIL, "hash", null, null, "Player", "player_one");
    }

    private static LoginCode freshLoginCode() {
        return new LoginCode("123456", 0, IP, "FR", "Paris", true, Instant.now().plusSeconds(600), Instant.now());
    }
}
