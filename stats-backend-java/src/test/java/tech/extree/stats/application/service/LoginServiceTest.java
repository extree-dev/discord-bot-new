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
import tech.extree.stats.application.port.in.LoginUseCase;
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
import tech.extree.stats.domain.User;

class LoginServiceTest {

    private UserRepository userRepository;
    private PasswordHasher passwordHasher;
    private TurnstileVerifier turnstileVerifier;
    private GeoLookup geoLookup;
    private LoginLocationRepository loginLocationRepository;
    private LoginEventRepository loginEventRepository;
    private LoginCodeRepository loginCodeRepository;
    private Mailer mailer;
    private SessionCodec sessionCodec;
    private LoginService service;

    // 11 аргументов
    private final User user = new User(
            "user-id", "test@test.com", "hashed", Instant.now(), null, "Test", "test", null, false, false, false);

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordHasher = mock(PasswordHasher.class);
        turnstileVerifier = mock(TurnstileVerifier.class);
        geoLookup = mock(GeoLookup.class);
        loginLocationRepository = mock(LoginLocationRepository.class);
        loginEventRepository = mock(LoginEventRepository.class);
        loginCodeRepository = mock(LoginCodeRepository.class);
        mailer = mock(Mailer.class);
        sessionCodec = mock(SessionCodec.class);

        when(turnstileVerifier.verify("token", "ip")).thenReturn(true);
        when(geoLookup.lookup("ip")).thenReturn(new Location("US", "City"));
        when(sessionCodec.encrypt(any())).thenReturn("cookie");

        service = new LoginService(
                userRepository, passwordHasher, turnstileVerifier, geoLookup,
                loginLocationRepository, loginEventRepository, loginCodeRepository,
                mailer, sessionCodec);
    }

    @Test
    void loginTurnstileFails() {
        when(turnstileVerifier.verify("bad-token", "ip")).thenReturn(false);
        var result = service.login("test@test.com", "pass", "bad-token", "ip", true);
        assertEquals(LoginUseCase.LoginOutcome.TURNSTILE_FAILED, result.outcome());
    }

    @Test
    void loginInvalidCredentials() {
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));
        when(passwordHasher.verify("wrong", "hashed")).thenReturn(false);
        var result = service.login("test@test.com", "wrong", "token", "ip", true);
        assertEquals(LoginUseCase.LoginOutcome.INVALID_CREDENTIALS, result.outcome());
    }

    @Test
    void loginEmailNotVerified() {
        // 11 аргументов
        User unverified = new User(
                "user-id", "test@test.com", "hashed", null, null, "Test", "test", null, false, false, false);
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(unverified));
        when(passwordHasher.verify("pass", "hashed")).thenReturn(true);
        
        var result = service.login("test@test.com", "pass", "token", "ip", true);
        assertEquals(LoginUseCase.LoginOutcome.EMAIL_NOT_VERIFIED, result.outcome());
    }

    @Test
    void loginOk() {
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));
        when(passwordHasher.verify("pass", "hashed")).thenReturn(true);
        when(loginLocationRepository.hasAnyKnownLocation("user-id")).thenReturn(true);
        when(loginLocationRepository.isKnownLocation("user-id", "US")).thenReturn(true);

        var result = service.login("test@test.com", "pass", "token", "ip", true);
        assertEquals(LoginUseCase.LoginOutcome.OK, result.outcome());
        assertEquals("cookie", result.sessionCookie());
        verify(loginEventRepository).recordLogin("user-id", "ip", "US", "City");
        verify(mailer).sendSignInNotification(eq("test@test.com"), eq("ip"), eq("US"), eq("City"), anyString());
    }
}