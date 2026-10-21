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
import tech.extree.stats.application.port.in.PasswordResetUseCase.ForgotPasswordOutcome;
import tech.extree.stats.application.port.in.PasswordResetUseCase.ResetPasswordOutcome;
import tech.extree.stats.application.port.in.PasswordResetUseCase.ResetPasswordResult;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.application.port.out.LoginEventRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.PasswordResetRepository;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Location;
import tech.extree.stats.domain.PasswordReset;
import tech.extree.stats.domain.User;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    private static final String EMAIL = "player@example.com";
    private static final String IP = "203.0.113.7";

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetRepository passwordResetRepository;
    @Mock private PasswordHasher passwordHasher;
    @Mock private Mailer mailer;
    @Mock private GeoLookup geoLookup;
    @Mock private LoginEventRepository loginEventRepository;
    @Mock private SessionCodec sessionCodec;

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(
                userRepository, passwordResetRepository, passwordHasher, mailer, geoLookup, loginEventRepository, sessionCodec);
    }

    @Test
    void forgotPasswordRejectsInvalidEmail() {
        assertThat(service.forgotPassword("not-an-email", "stats.extree.tech")).isEqualTo(ForgotPasswordOutcome.INVALID_EMAIL);
        verify(userRepository, never()).findByEmail(any());
    }

    @Test
    void forgotPasswordRespectsCooldown() {
        when(passwordResetRepository.isOnCooldown(EMAIL)).thenReturn(true);

        assertThat(service.forgotPassword(EMAIL, "stats.extree.tech")).isEqualTo(ForgotPasswordOutcome.CODE_ON_COOLDOWN);
    }

    @Test
    void forgotPasswordReturnsOkEvenWhenNoAccountExists() {
        when(passwordResetRepository.isOnCooldown(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThat(service.forgotPassword(EMAIL, "stats.extree.tech")).isEqualTo(ForgotPasswordOutcome.OK);
        verify(mailer, never()).sendPasswordResetEmail(any(), any());
    }

    @Test
    void forgotPasswordSendsResetEmailWithHostBasedUrl() {
        when(passwordResetRepository.isOnCooldown(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user()));
        when(passwordResetRepository.createReset("user-1", EMAIL)).thenReturn("tok123");

        assertThat(service.forgotPassword(EMAIL, "stats.extree.tech")).isEqualTo(ForgotPasswordOutcome.OK);
        verify(mailer).sendPasswordResetEmail(EMAIL, "https://stats.extree.tech/reset-password?token=tok123");
    }

    @Test
    void forgotPasswordStaysOkEvenIfMailerThrows() {
        when(passwordResetRepository.isOnCooldown(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user()));
        when(passwordResetRepository.createReset(any(), any())).thenReturn("tok123");
        org.mockito.Mockito.doThrow(new RuntimeException("smtp down")).when(mailer).sendPasswordResetEmail(any(), any());

        assertThat(service.forgotPassword(EMAIL, "stats.extree.tech")).isEqualTo(ForgotPasswordOutcome.OK);
    }

    @Test
    void resetPasswordRejectsMissingToken() {
        assertThat(service.resetPassword("  ", "CorrectHorseBattery9", IP).outcome())
                .isEqualTo(ResetPasswordOutcome.INVALID_REQUEST);
    }

    @Test
    void resetPasswordRejectsInvalidPassword() {
        assertThat(service.resetPassword("tok123", "short", IP).outcome()).isEqualTo(ResetPasswordOutcome.INVALID_PASSWORD);
    }

    @Test
    void resetPasswordRejectsUnknownToken() {
        when(passwordResetRepository.getReset("tok123")).thenReturn(Optional.empty());

        assertThat(service.resetPassword("tok123", "CorrectHorseBattery9", IP).outcome())
                .isEqualTo(ResetPasswordOutcome.TOKEN_NOT_FOUND);
    }

    @Test
    void resetPasswordDeletesAndRejectsExpiredToken() {
        when(passwordResetRepository.getReset("tok123"))
                .thenReturn(Optional.of(new PasswordReset("tok123", "user-1", EMAIL, Instant.now().minusSeconds(1), Instant.now())));

        assertThat(service.resetPassword("tok123", "CorrectHorseBattery9", IP).outcome())
                .isEqualTo(ResetPasswordOutcome.TOKEN_EXPIRED);
        verify(passwordResetRepository).deleteReset("tok123");
    }

    @Test
    void resetPasswordLogsInOnSuccess() {
        when(passwordResetRepository.getReset("tok123"))
                .thenReturn(Optional.of(new PasswordReset("tok123", "user-1", EMAIL, Instant.now().plusSeconds(600), Instant.now())));
        when(passwordHasher.hash(anyString())).thenReturn("newhash");
        when(userRepository.updatePasswordHash(eq("user-1"), eq("newhash"))).thenReturn(Optional.of(user()));
        when(geoLookup.lookup(IP)).thenReturn(new Location("US", "NYC"));
        when(sessionCodec.encrypt(any())).thenReturn("session-token");

        ResetPasswordResult result = service.resetPassword("tok123", "CorrectHorseBattery9", IP);

        assertThat(result.outcome()).isEqualTo(ResetPasswordOutcome.OK);
        assertThat(result.email()).isEqualTo(EMAIL);
        assertThat(result.sessionCookie()).isEqualTo("session-token");
        verify(passwordResetRepository).deleteReset("tok123");
        verify(loginEventRepository).recordLogin("user-1", IP, "US", "NYC");
    }

    private static User user() {
        return new User("user-1", EMAIL, "hash", Instant.now(), null, "Player", "player_one");
    }
}
