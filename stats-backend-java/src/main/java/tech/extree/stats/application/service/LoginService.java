package tech.extree.stats.application.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.UtcTime;
import tech.extree.stats.application.Validation;
import tech.extree.stats.application.port.in.LoginUseCase;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.application.port.out.LoginAttemptRepository;
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

@Service
public class LoginService implements LoginUseCase {

    private static final Logger log = LoggerFactory.getLogger(LoginService.class);

    private static final long CODE_TTL_MINUTES = 10;
    private static final long RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;
    private static final int MAX_FAILED_ATTEMPTS_PER_15MIN = 10;
    private static final long FAILED_WINDOW_MINUTES = 15;

    // scrypt-хеш от фиктивного пароля — для timing-attack fix (одинаковое
    // время ответа, есть user или нет). Сгенерирован вручную через
    // ScryptPasswordHasher.hash("dummy-timing-password"), ни с чем не совпадает.
    private static final String DUMMY_HASH =
            "00000000000000000000000000000000:"
            + "0000000000000000000000000000000000000000000000000000000000000000"
            + "0000000000000000000000000000000000000000000000000000000000000000";

    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;
    private final TurnstileVerifier turnstileVerifier;
    private final GeoLookup geoLookup;
    private final LoginLocationRepository loginLocationRepository;
    private final LoginEventRepository loginEventRepository;
    private final LoginCodeRepository loginCodeRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final Mailer mailer;
    private final SessionCodec sessionCodec;
    private final TotpService totpService;
    private final Pre2faService pre2faService;
    private final SecureRandom secureRandom = new SecureRandom();

    public LoginService(
            UserRepository userRepository,
            PasswordHasher passwordHasher,
            TurnstileVerifier turnstileVerifier,
            GeoLookup geoLookup,
            LoginLocationRepository loginLocationRepository,
            LoginEventRepository loginEventRepository,
            LoginCodeRepository loginCodeRepository,
            LoginAttemptRepository loginAttemptRepository,
            Mailer mailer,
            SessionCodec sessionCodec,
            TotpService totpService,
            Pre2faService pre2faService) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
        this.turnstileVerifier = turnstileVerifier;
        this.geoLookup = geoLookup;
        this.loginLocationRepository = loginLocationRepository;
        this.loginEventRepository = loginEventRepository;
        this.loginCodeRepository = loginCodeRepository;
        this.loginAttemptRepository = loginAttemptRepository;
        this.mailer = mailer;
        this.sessionCodec = sessionCodec;
        this.totpService = totpService;
        this.pre2faService = pre2faService;
    }

    @Override
    public LoginResult login(String rawEmail, String password, String turnstileToken, String clientIp, boolean rememberMe) {
        String email = Validation.normalizeEmail(rawEmail);

        if (!turnstileVerifier.verify(turnstileToken, clientIp)) {
            return LoginResult.error(LoginOutcome.TURNSTILE_FAILED);
        }
        if (!Validation.isValidEmail(email) || password == null) {
            return LoginResult.error(LoginOutcome.INVALID_REQUEST);
        }

        // Rate-limit per email (не только per-IP)
        Instant failedSince = Instant.now().minus(FAILED_WINDOW_MINUTES, ChronoUnit.MINUTES);
        if (loginAttemptRepository.countFailuresSince(email, failedSince) >= MAX_FAILED_ATTEMPTS_PER_15MIN) {
            return LoginResult.error(LoginOutcome.TOO_MANY_ATTEMPTS);
        }

        // Timing fix: всегда scrypt (даже для несуществующего email)
        Optional<User> maybeUser = userRepository.findByEmail(email);
        String hashToCheck = maybeUser.map(User::passwordHash).orElse(DUMMY_HASH);
        boolean passwordOk = passwordHasher.verify(password, hashToCheck);
        if (maybeUser.isEmpty() || !passwordOk) {
            loginAttemptRepository.record(email, clientIp, null, false, "invalid_credentials");
            return LoginResult.error(LoginOutcome.INVALID_CREDENTIALS);
        }

        User user = maybeUser.get();

        if (user.isBanned()) {
            loginAttemptRepository.record(email, clientIp, null, false, "banned");
            return LoginResult.error(LoginOutcome.BANNED);
        }

        if (!user.emailVerified()) {
            loginAttemptRepository.record(email, clientIp, null, false, "email_not_verified");
            return LoginResult.error(LoginOutcome.EMAIL_NOT_VERIFIED);
        }

        // 2FA: если включена — выдаём pre2fa cookie и возвращаем REQUIRES_2FA
        if (totpService.isEnabled(user.id())) {
            String pre2faToken = pre2faService.encode(user.id(), rememberMe);
            return new LoginResult(LoginOutcome.REQUIRES_2FA, email, pre2faToken);
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
        loginAttemptRepository.record(email, clientIp, location.country(), true, "ok");
        try {
            mailer.sendSignInNotification(email, clientIp, location.country(), location.city(), UtcTime.now());
        } catch (Exception e) {
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

        loginLocationRepository.rememberLocation(user.id(), row.country(), row.city(), row.ip());
        loginEventRepository.recordLogin(user.id(), row.ip(), row.country(), row.city());
        loginCodeRepository.deleteCode(email);

        String cookie = sessionCodec.encrypt(new Session(null, user.id(), System.currentTimeMillis()));
        return new ConfirmLocationResult(ConfirmLocationOutcome.OK, user.email(), cookie, row.remember());
    }

    @Override
    public Verify2faResult verify2fa(String pre2faToken, String totpCode) {
        if (pre2faToken == null || pre2faToken.isBlank() || totpCode == null || totpCode.isBlank()) {
            return Verify2faResult.error(Verify2faOutcome.INVALID_REQUEST);
        }
        Optional<Pre2faService.Pre2faPayload> payload = pre2faService.decode(pre2faToken);
        if (payload.isEmpty()) {
            return Verify2faResult.error(Verify2faOutcome.PRE_2FA_EXPIRED);
        }
        Optional<User> maybeUser = userRepository.findById(payload.get().userId());
        if (maybeUser.isEmpty()) {
            return Verify2faResult.error(Verify2faOutcome.INTERNAL_ERROR);
        }
        User user = maybeUser.get();
        if (user.isBanned()) {
            return Verify2faResult.error(Verify2faOutcome.BANNED);
        }

        boolean ok;
        if (totpCode.trim().matches("\\d{6}")) {
            ok = totpService.verifyCodeForUser(user.id(), totpCode.trim());
        } else {
            ok = totpService.consumeRecoveryCode(user.id(), totpCode.trim());
        }
        if (!ok) {
            loginAttemptRepository.record(user.email(), null, null, false, "totp_failed");
            return Verify2faResult.error(Verify2faOutcome.TOTP_INVALID);
        }

        loginAttemptRepository.record(user.email(), null, null, true, "2fa_ok");
        String cookie = sessionCodec.encrypt(new Session(null, user.id(), System.currentTimeMillis()));
        return new Verify2faResult(Verify2faOutcome.OK, user.email(), cookie, payload.get().rememberMe());
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
}