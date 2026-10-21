package tech.extree.stats.application.service;

import java.time.Instant;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.UtcTime;
import tech.extree.stats.application.Validation;
import tech.extree.stats.application.port.in.PasswordResetUseCase;
import tech.extree.stats.application.port.out.GeoLookup;
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

    private final UserRepository userRepository;
    private final PasswordResetRepository passwordResetRepository;
    private final PasswordHasher passwordHasher;
    private final Mailer mailer;
    private final GeoLookup geoLookup;
    private final LoginEventRepository loginEventRepository;
    private final SessionCodec sessionCodec;

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetRepository passwordResetRepository,
            PasswordHasher passwordHasher,
            Mailer mailer,
            GeoLookup geoLookup,
            LoginEventRepository loginEventRepository,
            SessionCodec sessionCodec) {
        this.userRepository = userRepository;
        this.passwordResetRepository = passwordResetRepository;
        this.passwordHasher = passwordHasher;
        this.mailer = mailer;
        this.geoLookup = geoLookup;
        this.loginEventRepository = loginEventRepository;
        this.sessionCodec = sessionCodec;
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
    public ResetPasswordResult resetPassword(String rawToken, String newPassword, String clientIp) {
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

        Optional<User> maybeUser = userRepository.updatePasswordHash(row.userId(), passwordHasher.hash(newPassword));
        passwordResetRepository.deleteReset(token);
        if (maybeUser.isEmpty()) {
            return ResetPasswordResult.error(ResetPasswordOutcome.INTERNAL_ERROR);
        }
        User user = maybeUser.get();

        Location location = geoLookup.lookup(clientIp);
        loginEventRepository.recordLogin(user.id(), clientIp, location.country(), location.city());
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
