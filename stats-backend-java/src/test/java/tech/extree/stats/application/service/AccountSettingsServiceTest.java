package tech.extree.stats.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tech.extree.stats.application.port.in.AccountSettingsUseCase;
import tech.extree.stats.application.port.out.EmailChangeCodeRepository;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.application.port.out.LoginEventRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.EmailChangeCode;
import tech.extree.stats.domain.Location;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

class AccountSettingsServiceTest {

    private UserRepository userRepository;
    private PasswordHasher passwordHasher;
    private EmailChangeCodeRepository emailChangeCodeRepository;
    private GeoLookup geoLookup;
    private Mailer mailer;
    private AccountSettingsService service;

    // 11 аргументов: ... isVerified, isBanned, isAdmin
    private final User user = new User(
            "user-id", "test@test.com", "hashed", Instant.now(), null, "Test", "test", null, false, false, false);

    @BeforeEach
    void setUp() {
        SessionCodec sessionCodec = mock(SessionCodec.class);
        userRepository = mock(UserRepository.class);
        passwordHasher = mock(PasswordHasher.class);
        emailChangeCodeRepository = mock(EmailChangeCodeRepository.class);
        LoginEventRepository loginEventRepository = mock(LoginEventRepository.class);
        geoLookup = mock(GeoLookup.class);
        mailer = mock(Mailer.class);

        when(sessionCodec.decrypt("cookie")).thenReturn(Optional.of(new Session(null, "user-id", 0)));
        when(userRepository.findById("user-id")).thenReturn(Optional.of(user));
        when(geoLookup.lookup(anyString())).thenReturn(Location.UNKNOWN);

        service = new AccountSettingsService(
                sessionCodec, userRepository, passwordHasher, emailChangeCodeRepository,
                loginEventRepository, geoLookup, mailer);
    }

    @Test
    void changeEmailUnauthorized() {
        var outcome = service.changeEmail(null, "pass", "new@test.com");
        assertEquals(AccountSettingsUseCase.ChangeEmailOutcome.UNAUTHORIZED, outcome);
    }

    @Test
    void changeEmailWrongPassword() {
        when(passwordHasher.verify("wrong", "hashed")).thenReturn(false);
        var outcome = service.changeEmail("cookie", "wrong", "new@test.com");
        assertEquals(AccountSettingsUseCase.ChangeEmailOutcome.WRONG_PASSWORD, outcome);
    }

    @Test
    void changeEmailOk() {
        when(passwordHasher.verify("correct", "hashed")).thenReturn(true);
        when(userRepository.findByEmail("new@test.com")).thenReturn(Optional.empty());
        when(emailChangeCodeRepository.getCode("user-id")).thenReturn(Optional.empty());

        var outcome = service.changeEmail("cookie", "correct", "new@test.com");
        assertEquals(AccountSettingsUseCase.ChangeEmailOutcome.OK, outcome);
        verify(emailChangeCodeRepository).upsertCode(eq("user-id"), eq("new@test.com"), anyString(), any());
        verify(mailer).sendEmailChangeCode(eq("new@test.com"), anyString());
        verify(mailer).sendEmailChangeNotice(eq("test@test.com"), eq("new@test.com"));
    }

    @Test
    void confirmEmailChangeWrongCode() {
        EmailChangeCode pending = new EmailChangeCode(
                "new@test.com", "123456", 0, Instant.now().plusSeconds(600), Instant.now());
        when(emailChangeCodeRepository.getCode("user-id")).thenReturn(Optional.of(pending));

        var result = service.confirmEmailChange("cookie", "000000");
        assertEquals(AccountSettingsUseCase.ConfirmEmailChangeOutcome.WRONG_CODE, result.outcome());
        verify(emailChangeCodeRepository).registerFailedAttempt("user-id");
    }

    @Test
    void changePasswordWrongPassword() {
        when(passwordHasher.verify("wrong", "hashed")).thenReturn(false);
        var outcome = service.changePassword("cookie", "wrong", "newpassword1", "127.0.0.1");
        assertEquals(AccountSettingsUseCase.ChangePasswordOutcome.WRONG_PASSWORD, outcome);
    }

    @Test
    void changePasswordOk() {
        when(passwordHasher.verify("correct", "hashed")).thenReturn(true);
        when(passwordHasher.hash("newpassword1")).thenReturn("newhash");
        // 11 аргументов
        when(userRepository.updatePasswordHash("user-id", "newhash"))
                .thenReturn(Optional.of(new User(
                        "user-id", "test@test.com", "newhash", Instant.now(), null, "Test", "test", null, false, false, false)));

        var outcome = service.changePassword("cookie", "correct", "newpassword1", "127.0.0.1");
        assertEquals(AccountSettingsUseCase.ChangePasswordOutcome.OK, outcome);
        verify(mailer).sendPasswordChanged(eq("test@test.com"), eq("127.0.0.1"), eq(null), eq(null), anyString());
    }
}