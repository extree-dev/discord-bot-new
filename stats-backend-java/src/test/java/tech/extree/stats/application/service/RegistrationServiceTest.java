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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import tech.extree.stats.application.port.in.RegistrationUseCase.RegisterOutcome;
import tech.extree.stats.application.port.in.RegistrationUseCase.ResendOutcome;
import tech.extree.stats.application.port.in.RegistrationUseCase.VerifyOutcome;
import tech.extree.stats.application.port.in.RegistrationUseCase.VerifyResult;
import tech.extree.stats.application.port.out.EmailCodeRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.EmailCode;
import tech.extree.stats.domain.NicknameTakenException;
import tech.extree.stats.domain.User;

/**
 * Проверяет, что RegistrationService повторяет порядок валидации и
 * error-коды /auth/register, /auth/resend-code, /auth/verify из
 * server.js (Node) — см. комментарий в самом сервисе со ссылкой на
 * конкретные строки. Все выходные порты замоканы — это проверка
 * логики, а не интеграции с БД/SMTP (для этого см. JdbcUserRepository/
 * JdbcEmailCodeRepository/SmtpMailer — проверяются вручную против живого
 * Postgres, как и в фазе 1).
 */
@ExtendWith(MockitoExtension.class)
class RegistrationServiceTest {

    private static final String EMAIL = "player@example.com";
    private static final String PASSWORD = "CorrectHorseBattery9";
    private static final String NAME = "Player One";
    private static final String NICKNAME = "player_one";

    @Mock private UserRepository userRepository;
    @Mock private EmailCodeRepository emailCodeRepository;
    @Mock private PasswordHasher passwordHasher;
    @Mock private Mailer mailer;
    @Mock private SessionCodec sessionCodec;

    private RegistrationService service;

    @BeforeEach
    void setUp() {
        service = new RegistrationService(userRepository, emailCodeRepository, passwordHasher, mailer, sessionCodec);
    }

    @Test
    void registerRejectsInvalidEmailBeforeTouchingAnyPort() {
        RegisterOutcome outcome = service.register("not-an-email", PASSWORD, NAME, NICKNAME);

        assertThat(outcome).isEqualTo(RegisterOutcome.INVALID_EMAIL);
        verify(userRepository, never()).findByEmail(any());
    }

    @Test
    void registerRejectsInvalidPassword() {
        assertThat(service.register(EMAIL, "short", NAME, NICKNAME)).isEqualTo(RegisterOutcome.INVALID_PASSWORD);
    }

    @Test
    void registerRejectsInvalidName() {
        assertThat(service.register(EMAIL, PASSWORD, "   ", NICKNAME)).isEqualTo(RegisterOutcome.INVALID_NAME);
    }

    @Test
    void registerRejectsInvalidNickname() {
        assertThat(service.register(EMAIL, PASSWORD, NAME, "a")).isEqualTo(RegisterOutcome.INVALID_NICKNAME);
    }

    @Test
    void registerRejectsAlreadyVerifiedEmail() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));

        assertThat(service.register(EMAIL, PASSWORD, NAME, NICKNAME))
                .isEqualTo(RegisterOutcome.EMAIL_ALREADY_REGISTERED);
    }

    @Test
    void registerRejectsOnCooldown() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(emailCodeRepository.getCode(EMAIL)).thenReturn(Optional.of(freshCode()));

        assertThat(service.register(EMAIL, PASSWORD, NAME, NICKNAME)).isEqualTo(RegisterOutcome.CODE_ON_COOLDOWN);
    }

    @Test
    void registerMapsNicknameTakenException() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(emailCodeRepository.getCode(EMAIL)).thenReturn(Optional.empty());
        when(passwordHasher.hash(PASSWORD)).thenReturn("hashed");
        when(userRepository.upsertUnverifiedUser(EMAIL, "hashed", NAME, NICKNAME))
                .thenThrow(new NicknameTakenException(NICKNAME));

        assertThat(service.register(EMAIL, PASSWORD, NAME, NICKNAME)).isEqualTo(RegisterOutcome.NICKNAME_TAKEN);
    }

    @Test
    void registerSendsCodeAndReturnsOk() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(emailCodeRepository.getCode(EMAIL)).thenReturn(Optional.empty());
        when(passwordHasher.hash(PASSWORD)).thenReturn("hashed");

        assertThat(service.register(EMAIL, PASSWORD, NAME, NICKNAME)).isEqualTo(RegisterOutcome.OK);
        verify(mailer).sendVerificationCode(eq(EMAIL), anyString());
        verify(emailCodeRepository).upsertCode(eq(EMAIL), anyString(), any(Instant.class));
    }

    @Test
    void resendCodeDoesNotRevealWhetherTheEmailIsRegistered() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThat(service.resendCode(EMAIL)).isEqualTo(ResendOutcome.OK);
        verify(mailer, never()).sendVerificationCode(any(), any());
    }

    @Test
    void resendCodeDoesNotRevealThatTheEmailIsAlreadyVerified() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));

        assertThat(service.resendCode(EMAIL)).isEqualTo(ResendOutcome.OK);
        verify(mailer, never()).sendVerificationCode(any(), any());
    }

    @Test
    void resendCodeRespectsCooldown() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(unverifiedUser()));
        when(emailCodeRepository.getCode(EMAIL)).thenReturn(Optional.of(freshCode()));

        assertThat(service.resendCode(EMAIL)).isEqualTo(ResendOutcome.CODE_ON_COOLDOWN);
    }

    @Test
    void verifyRejectsMissingCode() {
        VerifyResult result = service.verify(EMAIL, "  ");

        assertThat(result.outcome()).isEqualTo(VerifyOutcome.INVALID_REQUEST);
    }

    @Test
    void verifyRejectsWhenNoCodeWasIssued() {
        when(emailCodeRepository.getCode(EMAIL)).thenReturn(Optional.empty());

        assertThat(service.verify(EMAIL, "123456").outcome()).isEqualTo(VerifyOutcome.CODE_NOT_FOUND);
    }

    @Test
    void verifyDeletesAndRejectsExpiredCode() {
        when(emailCodeRepository.getCode(EMAIL))
                .thenReturn(Optional.of(new EmailCode("123456", 0, Instant.now().minusSeconds(1), Instant.now())));

        assertThat(service.verify(EMAIL, "123456").outcome()).isEqualTo(VerifyOutcome.CODE_EXPIRED);
        verify(emailCodeRepository).deleteCode(EMAIL);
    }

    @Test
    void verifyRejectsAfterTooManyAttempts() {
        when(emailCodeRepository.getCode(EMAIL))
                .thenReturn(Optional.of(
                        new EmailCode("123456", 5, Instant.now().plusSeconds(60), Instant.now())));

        assertThat(service.verify(EMAIL, "123456").outcome()).isEqualTo(VerifyOutcome.TOO_MANY_ATTEMPTS);
    }

    @Test
    void verifyRegistersFailedAttemptOnWrongCode() {
        when(emailCodeRepository.getCode(EMAIL)).thenReturn(Optional.of(freshCode()));

        assertThat(service.verify(EMAIL, "000000").outcome()).isEqualTo(VerifyOutcome.WRONG_CODE);
        verify(emailCodeRepository).registerFailedAttempt(EMAIL);
    }

    @Test
    void verifyIssuesSessionCookieOnSuccess() {
        when(emailCodeRepository.getCode(EMAIL)).thenReturn(Optional.of(freshCode()));
        when(userRepository.markEmailVerified(EMAIL)).thenReturn(Optional.of(verifiedUser()));
        when(sessionCodec.encrypt(any())).thenReturn("encrypted-token");

        VerifyResult result = service.verify(EMAIL, "123456");

        assertThat(result.outcome()).isEqualTo(VerifyOutcome.OK);
        assertThat(result.email()).isEqualTo(EMAIL);
        assertThat(result.sessionCookie()).isEqualTo("encrypted-token");
        verify(emailCodeRepository).deleteCode(EMAIL);
    }

    private static User verifiedUser() {
        return new User("user-1", EMAIL, "hash", Instant.now(), null, NAME, NICKNAME);
    }

    private static User unverifiedUser() {
        return new User("user-1", EMAIL, "hash", null, null, NAME, NICKNAME);
    }

    private static EmailCode freshCode() {
        return new EmailCode("123456", 0, Instant.now().plusSeconds(600), Instant.now());
    }
}
