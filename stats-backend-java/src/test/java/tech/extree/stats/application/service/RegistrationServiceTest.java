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
import tech.extree.stats.application.port.in.RegistrationUseCase;
import tech.extree.stats.application.port.out.EmailCodeRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.EmailCode;
import tech.extree.stats.domain.NicknameTakenException;
import tech.extree.stats.domain.User;

class RegistrationServiceTest {

    private UserRepository userRepository;
    private EmailCodeRepository emailCodeRepository;
    private PasswordHasher passwordHasher;
    private Mailer mailer;
    private PasswordPolicyService passwordPolicy;
    private SessionCodec sessionCodec;
    private RegistrationService service;

    private final User user = new User(
            "user-id", "test@test.com", "hashed", Instant.now(), null, "Test", "test", null, false, false, false);

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        emailCodeRepository = mock(EmailCodeRepository.class);
        passwordHasher = mock(PasswordHasher.class);
        mailer = mock(Mailer.class);
        passwordPolicy = mock(PasswordPolicyService.class);
        sessionCodec = mock(SessionCodec.class);

        when(passwordHasher.hash("password1")).thenReturn("hashed");
        when(sessionCodec.encrypt(any())).thenReturn("cookie");
        // Политика паролей — разрешаем всё (в тестах не про неё)
        when(passwordPolicy.validate(anyString(), any(), any(), any())).thenReturn(PasswordPolicyService.Result.ok());

        service = new RegistrationService(
                userRepository, emailCodeRepository, passwordHasher,
                mailer, passwordPolicy, sessionCodec);
    }

    @Test
    void registerEmailAlreadyRegistered() {
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));
        var outcome = service.register("test@test.com", "password1", "Name", "Nick");
        assertEquals(RegistrationUseCase.RegisterOutcome.EMAIL_ALREADY_REGISTERED, outcome);
    }

    @Test
    void registerNicknameTaken() {
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.empty());
        when(emailCodeRepository.getCode("test@test.com")).thenReturn(Optional.empty());
        when(userRepository.upsertUnverifiedUser(anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new NicknameTakenException("Nick"));

        var outcome = service.register("test@test.com", "password1", "Name", "Nick");
        assertEquals(RegistrationUseCase.RegisterOutcome.NICKNAME_TAKEN, outcome);
    }

    @Test
    void registerOk() {
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.empty());
        when(emailCodeRepository.getCode("test@test.com")).thenReturn(Optional.empty());
        when(userRepository.upsertUnverifiedUser(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(user);

        var outcome = service.register("test@test.com", "password1", "Name", "Nick");
        assertEquals(RegistrationUseCase.RegisterOutcome.OK, outcome);
        verify(emailCodeRepository).upsertCode(eq("test@test.com"), anyString(), any());
        verify(mailer).sendVerificationCode(eq("test@test.com"), anyString());
    }

    @Test
    void verifyWrongCode() {
        EmailCode pending = new EmailCode("123456", 0, Instant.now().plusSeconds(600), Instant.now());
        when(emailCodeRepository.getCode("test@test.com")).thenReturn(Optional.of(pending));

        var result = service.verify("test@test.com", "000000");
        assertEquals(RegistrationUseCase.VerifyOutcome.WRONG_CODE, result.outcome());
        verify(emailCodeRepository).registerFailedAttempt("test@test.com");
    }

    @Test
    void verifyOk() {
        EmailCode pending = new EmailCode("123456", 0, Instant.now().plusSeconds(600), Instant.now());
        when(emailCodeRepository.getCode("test@test.com")).thenReturn(Optional.of(pending));
        when(userRepository.markEmailVerified("test@test.com")).thenReturn(Optional.of(user));

        var result = service.verify("test@test.com", "123456");
        assertEquals(RegistrationUseCase.VerifyOutcome.OK, result.outcome());
        assertEquals("cookie", result.sessionCookie());
        verify(emailCodeRepository).deleteCode("test@test.com");
    }
}