package tech.extree.stats.application.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.UtcTime;
import tech.extree.stats.application.Validation;
import tech.extree.stats.application.port.in.PasswordResetUseCase;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.application.port.out.LoginAttemptRepository;
import tech.extree.stats.application.port.out.LoginEventRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.PasswordResetRepository;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Location;
import tech.extree.stats.domain.PasswordReset;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

/** Соответствует /auth/forgot-password, /auth/reset-password в server.js. */
@Service
public class PasswordResetService implements PasswordResetUseCase {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private static final int MAX_FAILED_ATTEMPTS_PER_15MIN = 10;
    private static final long FAILED_WINDOW_MINUTES = 15;

    private final UserRepository userRepository;
    private final PasswordResetRepository passwordResetRepository;
    private final PasswordHasher passwordHasher;
    private final Mailer mailer;
    private final GeoLookup geoLookup;
    private final LoginEventRepository loginEventRepository;
    private final PasswordPolicyService passwordPolicy;
    private final SessionCodec sessionCodec;
    private final TotpService totpService;
    private final LoginAttemptRepository loginAttemptRepository;

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetRepository passwordResetRepository,
            PasswordHasher passwordHasher,
            Mailer mailer,
            GeoLookup geoLookup,
            LoginEventRepository loginEventRepository,
            PasswordPolicyService passwordPolicy,
            SessionCodec sessionCodec,
            TotpService totpService,
            LoginAttemptRepository loginAttemptRepository) {
        this.userRepository = userRepository;
        this.passwordResetRepository = passwordResetRepository;
        this.passwordHasher = passwordHasher;
        this.mailer = mailer;
        this.geoLookup = geoLookup;
        this.loginEventRepository = loginEventRepository;
        this.sessionCodec = sessionCodec;
        this.passwordPolicy = passwordPolicy;
        this.totpService = totpService;
        this.loginAttemptRepository = loginAttemptRepository;
    }

    @Override
    public ForgotPasswordOutcome forgotPassword(String rawEmail, String requestHost) {
        String email = Validation.normalizeEmail(rawEmail);
        if (!Validation.isValidEmail(email)) {
            return ForgotPasswordOutcome.INVALID_EMAIL;
        }
        if (passwordResetRepository.isOnCooldown(email)) {
            return ForgotPasswordOutcome.CODE_ON_COOLDOWN;
        }

        // Один и тот же ответ независимо от того, существует ли аккаунт,
        // и даже при сбое отправки письма — тот же анти-перебор приём, что
        // у Node (см. комментарий в server.js).
        userRepository.findByEmail(email).ifPresent(user -> {
            try {
                String token = passwordResetRepository.createReset(user.id(), email);
                String resetUrl = "https://" + requestHost + "/reset-password?token=" + token;
                mailer.sendPasswordResetEmail(email, resetUrl);
            } catch (Exception e) {
                log.warn("stats-backend-java: ошибка отправки письма сброса пароля", e);
            }
        });
        return ForgotPasswordOutcome.OK;
    }

    @Override
    public ResetPasswordResult resetPassword(
            String rawToken, String newPassword, String totpCode, String clientIp, String userAgent) {
        String token = rawToken == null ? "" : rawToken.trim();
        if (token.isEmpty()) {
            return ResetPasswordResult.error(ResetPasswordOutcome.INVALID_REQUEST);
        }
        if (!Validation.isValidPassword(newPassword)) {
            return ResetPasswordResult.error(ResetPasswordOutcome.INVALID_PASSWORD);
        }

        Optional<PasswordReset> maybeRow = passwordResetRepository.getReset(token);
        if (maybeRow.isEmpty()) {
            return ResetPasswordResult.error(ResetPasswordOutcome.TOKEN_NOT_FOUND);
        }
        PasswordReset row = maybeRow.get();
        if (Instant.now().isAfter(row.expiresAt())) {
            passwordResetRepository.deleteReset(token);
            return ResetPasswordResult.error(ResetPasswordOutcome.TOKEN_EXPIRED);
        }

        PasswordPolicyService.Result pp = passwordPolicy.validate(newPassword, row.email(), null, null);
        if (!pp.valid()) {
            return ResetPasswordResult.error(ResetPasswordOutcome.INVALID_PASSWORD);
        }

        // Сброс пароля через email — отдельный от обычного логина канал,
        // который не доказывает владение вторым фактором. Без этой проверки
        // кто угодно, временно получивший доступ к почте, полностью обходил
        // бы 2FA. Токен и пароль НЕ применяются, пока не придёт верный код —
        // фронт повторяет тот же запрос с добавленным totpCode.
        if (totpService.isEnabled(row.userId())) {
            Instant failedSince = Instant.now().minus(FAILED_WINDOW_MINUTES, ChronoUnit.MINUTES);
            if (loginAttemptRepository.countFailuresSince(row.email(), failedSince) >= MAX_FAILED_ATTEMPTS_PER_15MIN) {
                return ResetPasswordResult.error(ResetPasswordOutcome.TOO_MANY_ATTEMPTS);
            }
            String code = totpCode == null ? "" : totpCode.trim();
            if (code.isEmpty()) {
                return ResetPasswordResult.error(ResetPasswordOutcome.TOTP_REQUIRED);
            }
            boolean totpOk = code.matches("\\d{6}")
                    ? totpService.verifyCodeForUser(row.userId(), code)
                    : totpService.consumeRecoveryCode(row.userId(), code);
            if (!totpOk) {
                loginAttemptRepository.record(row.email(), clientIp, null, false, "reset_totp_failed");
                return ResetPasswordResult.error(ResetPasswordOutcome.TOTP_INVALID);
            }
        }

        Optional<User> maybeUser = userRepository.updatePasswordHash(row.userId(), passwordHasher.hash(newPassword));
        passwordResetRepository.deleteReset(token);
        if (maybeUser.isEmpty()) {
            return ResetPasswordResult.error(ResetPasswordOutcome.INTERNAL_ERROR);
        }
        User user = maybeUser.get();

        Location location = geoLookup.lookup(clientIp);
        loginEventRepository.recordLogin(user.id(), clientIp, location.country(), location.city(), userAgent);
        try {
            mailer.sendPasswordChanged(user.email(), clientIp, location.country(), location.city(), UtcTime.now());
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка отправки уведомления о смене пароля", e);
        }

        // Успешный сброс — это тоже вход: сразу логинит, как и Node.
        String cookie = sessionCodec.encrypt(new Session(null, user.id(), System.currentTimeMillis()));
        return new ResetPasswordResult(ResetPasswordOutcome.OK, user.email(), cookie);
    }
}
