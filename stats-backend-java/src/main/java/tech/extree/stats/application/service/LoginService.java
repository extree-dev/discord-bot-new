package tech.extree.stats.application.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.Validation;
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
import tech.extree.stats.domain.LoginCode;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

/**
 * Соответствует блоку /auth/login, /auth/login/resend-code,
 * /auth/login/confirm-location в server.js — порядок проверок и
 * error-коды повторены один в один, включая "известное место входа"
 * (geo по стране, не по точному IP) и anti-enumeration поведение
 * resendCode. Таймауты те же, что у loginCodes.js (10 минут жизни,
 * 60 секунд между повторной отправкой, 5 попыток).
 */
@Service
public class LoginService implements LoginUseCase {

    private static final Logger log = LoggerFactory.getLogger(LoginService.class);

    private static final long CODE_TTL_MINUTES = 10;
    private static final long RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;

    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;
    private final TurnstileVerifier turnstileVerifier;
    private final GeoLookup geoLookup;
    private final LoginLocationRepository loginLocationRepository;
    private final LoginEventRepository loginEventRepository;
    private final LoginCodeRepository loginCodeRepository;
    private final Mailer mailer;
    private final SessionCodec sessionCodec;
    private final SecureRandom secureRandom = new SecureRandom();

    public LoginService(
            UserRepository userRepository,
            PasswordHasher passwordHasher,
            TurnstileVerifier turnstileVerifier,
            GeoLookup geoLookup,
            LoginLocationRepository loginLocationRepository,
            LoginEventRepository loginEventRepository,
            LoginCodeRepository loginCodeRepository,
            Mailer mailer,
            SessionCodec sessionCodec) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
        this.turnstileVerifier = turnstileVerifier;
        this.geoLookup = geoLookup;
        this.loginLocationRepository = loginLocationRepository;
        this.loginEventRepository = loginEventRepository;
        this.loginCodeRepository = loginCodeRepository;
        this.mailer = mailer;
        this.sessionCodec = sessionCodec;
    }

    @Override
    public LoginResult login(String rawEmail, String password, String turnstileToken, String clientIp, boolean rememberMe) {
        String email = Validation.normalizeEmail(rawEmail);

        // Turnstile раньше всего остального — та же причина, что в Node:
        // отсекаем ботов/перебор credential stuffing до обращения к БД.
        if (!turnstileVerifier.verify(turnstileToken, clientIp)) {
            return LoginResult.error(LoginOutcome.TURNSTILE_FAILED);
        }
        if (!Validation.isValidEmail(email) || password == null) {
            return LoginResult.error(LoginOutcome.INVALID_REQUEST);
        }

        Optional<User> maybeUser = userRepository.findByEmail(email);
        if (maybeUser.isEmpty() || !passwordHasher.verify(password, maybeUser.get().passwordHash())) {
            return LoginResult.error(LoginOutcome.INVALID_CREDENTIALS);
        }
        User user = maybeUser.get();
        if (!user.emailVerified()) {
            return LoginResult.error(LoginOutcome.EMAIL_NOT_VERIFIED);
        }

        Location location = geoLookup.lookup(clientIp);

        boolean hasHistory = loginLocationRepository.hasAnyKnownLocation(user.id());
        boolean known = loginLocationRepository.isKnownLocation(user.id(), location.country());

        if (hasHistory && !known) {
            if (isOnCooldown(email)) {
                return LoginResult.error(LoginOutcome.CODE_ON_COOLDOWN);
            }
            try {
                issueAndSendLoginCode(email, clientIp, location, rememberMe);
            } catch (Exception e) {
                log.warn("stats-backend-java: ошибка отправки кода подтверждения нового места входа", e);
                return LoginResult.error(LoginOutcome.INTERNAL_ERROR);
            }
            return LoginResult.error(LoginOutcome.UNKNOWN_LOCATION);
        }

        loginLocationRepository.rememberLocation(user.id(), location.country(), location.city(), clientIp);
        loginEventRepository.recordLogin(user.id(), clientIp, location.country(), location.city());
        try {
            mailer.sendSignInNotification(email, clientIp, location.country(), location.city(), utcNow());
        } catch (Exception e) {
            // Уведомление не критично для самого входа — не роняем сессию
            // из-за временной проблемы с почтой, как и Node.
            log.warn("stats-backend-java: ошибка отправки уведомления о входе", e);
        }

        String cookie = sessionCodec.encrypt(new Session(null, user.id(), System.currentTimeMillis()));
        return new LoginResult(LoginOutcome.OK, user.email(), cookie);
    }

    @Override
    public ResendLoginCodeOutcome resendCode(String rawEmail) {
        String email = Validation.normalizeEmail(rawEmail);
        if (!Validation.isValidEmail(email)) {
            return ResendLoginCodeOutcome.INVALID_EMAIL;
        }

        Optional<LoginCode> pending = loginCodeRepository.getCode(email);
        if (pending.isEmpty()) {
            // Не сообщаем, есть ли вообще ожидающий подтверждения вход —
            // тот же приём, что у /auth/resend-code.
            return ResendLoginCodeOutcome.OK;
        }
        if (isOnCooldown(email)) {
            return ResendLoginCodeOutcome.CODE_ON_COOLDOWN;
        }

        try {
            LoginCode row = pending.get();
            issueAndSendLoginCode(
                    email, row.ip(), new Location(row.country(), row.city()), row.remember());
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка повторной отправки кода подтверждения входа", e);
            return ResendLoginCodeOutcome.INTERNAL_ERROR;
        }
        return ResendLoginCodeOutcome.OK;
    }

    @Override
    public ConfirmLocationResult confirmLocation(String rawEmail, String rawCode) {
        String email = Validation.normalizeEmail(rawEmail);
        String code = rawCode == null ? "" : rawCode.trim();
        if (!Validation.isValidEmail(email) || code.isEmpty()) {
            return ConfirmLocationResult.error(ConfirmLocationOutcome.INVALID_REQUEST);
        }

        Optional<LoginCode> maybeRow = loginCodeRepository.getCode(email);
        if (maybeRow.isEmpty()) {
            return ConfirmLocationResult.error(ConfirmLocationOutcome.CODE_NOT_FOUND);
        }
        LoginCode row = maybeRow.get();
        if (Instant.now().isAfter(row.expiresAt())) {
            loginCodeRepository.deleteCode(email);
            return ConfirmLocationResult.error(ConfirmLocationOutcome.CODE_EXPIRED);
        }
        if (row.attempts() >= MAX_ATTEMPTS) {
            return ConfirmLocationResult.error(ConfirmLocationOutcome.TOO_MANY_ATTEMPTS);
        }
        if (!code.equals(row.code())) {
            loginCodeRepository.registerFailedAttempt(email);
            return ConfirmLocationResult.error(ConfirmLocationOutcome.WRONG_CODE);
        }

        Optional<User> maybeUser = userRepository.findByEmail(email);
        if (maybeUser.isEmpty()) {
            return ConfirmLocationResult.error(ConfirmLocationOutcome.INTERNAL_ERROR);
        }
        User user = maybeUser.get();

        // Доверяем месту из исходной попытки входа (row), а не текущему
        // запросу — его могут подтверждать с другого устройства/сети.
        loginLocationRepository.rememberLocation(user.id(), row.country(), row.city(), row.ip());
        loginEventRepository.recordLogin(user.id(), row.ip(), row.country(), row.city());
        loginCodeRepository.deleteCode(email);

        String cookie = sessionCodec.encrypt(new Session(null, user.id(), System.currentTimeMillis()));
        return new ConfirmLocationResult(ConfirmLocationOutcome.OK, user.email(), cookie, row.remember());
    }

    private boolean isOnCooldown(String email) {
        return loginCodeRepository
                .getCode(email)
                .map(row -> row.createdAt().isAfter(Instant.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .orElse(false);
    }

    private void issueAndSendLoginCode(String email, String ip, Location location, boolean remember) {
        String code = generateCode();
        loginCodeRepository.upsertCode(
                email,
                code,
                ip,
                location.country(),
                location.city(),
                remember,
                Instant.now().plus(CODE_TTL_MINUTES, ChronoUnit.MINUTES));
        mailer.sendNewLocationCode(email, code, ip, location.country(), location.city());
    }

    private String generateCode() {
        return String.valueOf(100000 + secureRandom.nextInt(900000));
    }

    private static String utcNow() {
        return DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US)
                .withZone(java.time.ZoneOffset.UTC)
                .format(Instant.now());
    }
}
