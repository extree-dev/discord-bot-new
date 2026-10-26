package tech.extree.stats.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tech.extree.stats.application.port.in.PasswordResetUseCase;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.application.port.out.LoginAttemptRepository;
import tech.extree.stats.application.port.out.LoginEventRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.PasswordResetRepository;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Location;
import tech.extree.stats.domain.PasswordReset;
import tech.extree.stats.domain.User;

class PasswordResetServiceTest {

    private UserRepository userRepository;
    private PasswordResetRepository passwordResetRepository;
    private PasswordHasher passwordHasher;
    private Mailer mailer;
    private GeoLookup geoLookup;
    private LoginEventRepository loginEventRepository;
    private PasswordPolicyService passwordPolicy;
    private SessionRepository sessionRepository;
    private TotpService totpService;
    private LoginAttemptRepository loginAttemptRepository;
    private PasswordResetService service;

    private final User user = new User(
            "user-id", "test@test.com", "hashed", Instant.now(), null, "Test", "test", null, false, false, false);

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordResetRepository = mock(PasswordResetRepository.class);
        passwordHasher = mock(PasswordHasher.class);
        mailer = mock(Mailer.class);
        geoLookup = mock(GeoLookup.class);
        loginEventRepository = mock(LoginEventRepository.class);
        passwordPolicy = mock(PasswordPolicyService.class);
        sessionRepository = mock(SessionRepository.class);
        totpService = mock(TotpService.class);
        loginAttemptRepository = mock(LoginAttemptRepository.class);

        when(geoLookup.lookup("ip")).thenReturn(new Location("US", "City"));
        when(sessionRepository.create(any(), any(), any(), any(), anyBoolean()))
                .thenReturn(new SessionRepository.Created("cookie", "session-id"));
        // Политика паролей — разрешаем всё, в этих тестах не про неё
        when(passwordPolicy.validate(anyString(), any(), any(), any())).thenReturn(PasswordPolicyService.Result.ok());

        service = new PasswordResetService(
                userRepository, passwordResetRepository, passwordHasher,
                mailer, geoLookup, loginEventRepository, passwordPolicy, sessionRepository,
                totpService, loginAttemptRepository);
    }

    @Test
    void forgotPasswordCooldown() {
        when(passwordResetRepository.isOnCooldown("test@test.com")).thenReturn(true);
        var outcome = service.forgotPassword("test@test.com", "host");
        assertEquals(PasswordResetUseCase.ForgotPasswordOutcome.CODE_ON_COOLDOWN, outcome);
    }

    @Test
    void forgotPasswordOk() {
        when(passwordResetRepository.isOnCooldown("test@test.com")).thenReturn(false);
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));
        when(passwordResetRepository.createReset("user-id", "test@test.com")).thenReturn("token");

        var outcome = service.forgotPassword("test@test.com", "host");
        assertEquals(PasswordResetUseCase.ForgotPasswordOutcome.OK, outcome);
        verify(mailer).sendPasswordResetEmail(eq("test@test.com"), anyString());
    }

    @Test
    void resetPasswordTokenNotFound() {
        when(passwordResetRepository.getReset("token")).thenReturn(Optional.empty());
        var result = service.resetPassword("token", "newpassword1", null, "ip", "ua");
        assertEquals(PasswordResetUseCase.ResetPasswordOutcome.TOKEN_NOT_FOUND, result.outcome());
    }

    @Test
    void resetPasswordOk() {
        PasswordReset reset = new PasswordReset(
                "token", "user-id", "test@test.com", Instant.now().plusSeconds(600), Instant.now());
        when(passwordResetRepository.getReset("token")).thenReturn(Optional.of(reset));
        when(passwordHasher.hash("newpassword1")).thenReturn("newhash");
        when(userRepository.updatePasswordHash("user-id", "newhash")).thenReturn(Optional.of(user));

        var result = service.resetPassword("token", "newpassword1", null, "ip", "ua");
        assertEquals(PasswordResetUseCase.ResetPasswordOutcome.OK, result.outcome());
        verify(passwordResetRepository).deleteReset("token");
        verify(loginEventRepository).recordLogin("user-id", "ip", "US", "City", "ua", "session-id");
        verify(mailer).sendPasswordChanged(eq("test@test.com"), eq("ip"), eq("US"), eq("City"), anyString());
    }

    @Test
    void resetPasswordRequiresTotpWhenEnabledAndNoCodeGiven() {
        PasswordReset reset = new PasswordReset(
                "token", "user-id", "test@test.com", Instant.now().plusSeconds(600), Instant.now());
        when(passwordResetRepository.getReset("token")).thenReturn(Optional.of(reset));
        when(totpService.isEnabled("user-id")).thenReturn(true);

        var result = service.resetPassword("token", "newpassword1", null, "ip", "ua");
        assertEquals(PasswordResetUseCase.ResetPasswordOutcome.TOTP_REQUIRED, result.outcome());
        verify(passwordResetRepository, org.mockito.Mockito.never()).deleteReset(anyString());
        verify(userRepository, org.mockito.Mockito.never()).updatePasswordHash(anyString(), anyString());
    }

    @Test
    void resetPasswordRejectsWrongTotpCode() {
        PasswordReset reset = new PasswordReset(
                "token", "user-id", "test@test.com", Instant.now().plusSeconds(600), Instant.now());
        when(passwordResetRepository.getReset("token")).thenReturn(Optional.of(reset));
        when(totpService.isEnabled("user-id")).thenReturn(true);
        when(totpService.verifyCodeForUser("user-id", "000000")).thenReturn(false);

        var result = service.resetPassword("token", "newpassword1", "000000", "ip", "ua");
        assertEquals(PasswordResetUseCase.ResetPasswordOutcome.TOTP_INVALID, result.outcome());
        verify(userRepository, org.mockito.Mockito.never()).updatePasswordHash(anyString(), anyString());
    }

    @Test
    void resetPasswordSucceedsWithValidTotpCode() {
        PasswordReset reset = new PasswordReset(
                "token", "user-id", "test@test.com", Instant.now().plusSeconds(600), Instant.now());
        when(passwordResetRepository.getReset("token")).thenReturn(Optional.of(reset));
        when(totpService.isEnabled("user-id")).thenReturn(true);
        when(totpService.verifyCodeForUser("user-id", "123456")).thenReturn(true);
        when(passwordHasher.hash("newpassword1")).thenReturn("newhash");
        when(userRepository.updatePasswordHash("user-id", "newhash")).thenReturn(Optional.of(user));

        var result = service.resetPassword("token", "newpassword1", "123456", "ip", "ua");
        assertEquals(PasswordResetUseCase.ResetPasswordOutcome.OK, result.outcome());
        verify(passwordResetRepository).deleteReset("token");
    }
}