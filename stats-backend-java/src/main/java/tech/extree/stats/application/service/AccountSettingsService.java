package tech.extree.stats.application.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.UtcTime;
import tech.extree.stats.application.Validation;
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
import tech.extree.stats.domain.LoginEvent;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

/**
 * Соответствует requireSession + /auth/account/change-email,
 * /resend-email-change-code, /confirm-email-change,
 * /auth/account/change-password, /api/account/login-history в server.js.
 */
@Service
public class AccountSettingsService implements AccountSettingsUseCase {

    private static final Logger log = LoggerFactory.getLogger(AccountSettingsService.class);

    private static final long CODE_TTL_MINUTES = 10;
    private static final long RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;
    private static final int LOGIN_HISTORY_LIMIT = 10;

    private final SessionCodec sessionCodec;
    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;
    private final EmailChangeCodeRepository emailChangeCodeRepository;
    private final LoginEventRepository loginEventRepository;
    private final GeoLookup geoLookup;
    private final Mailer mailer;
    private final SecureRandom secureRandom = new SecureRandom();

    public AccountSettingsService(
            SessionCodec sessionCodec,
            UserRepository userRepository,
            PasswordHasher passwordHasher,
            EmailChangeCodeRepository emailChangeCodeRepository,
            LoginEventRepository loginEventRepository,
            GeoLookup geoLookup,
            Mailer mailer) {
        this.sessionCodec = sessionCodec;
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
        this.emailChangeCodeRepository = emailChangeCodeRepository;
        this.loginEventRepository = loginEventRepository;
        this.geoLookup = geoLookup;
        this.mailer = mailer;
    }

    @Override
    public ChangeEmailOutcome changeEmail(String cookieValue, String currentPassword, String rawNewEmail) {
        Optional<String> userId = resolveUserId(cookieValue);
        if (userId.isEmpty()) {
            return ChangeEmailOutcome.UNAUTHORIZED;
        }
        String newEmail = Validation.normalizeEmail(rawNewEmail);
        if (!Validation.isValidEmail(newEmail)) {
            return ChangeEmailOutcome.INVALID_EMAIL;
        }

        Optional<User> maybeUser = userRepository.findById(userId.get());
        if (maybeUser.isEmpty() || !passwordHasher.verify(currentPassword, maybeUser.get().passwordHash())) {
            return ChangeEmailOutcome.WRONG_PASSWORD;
        }
        User user = maybeUser.get();
        if (newEmail.equals(user.email())) {
            return ChangeEmailOutcome.SAME_EMAIL;
        }
        if (userRepository.findByEmail(newEmail).isPresent()) {
            return ChangeEmailOutcome.EMAIL_ALREADY_REGISTERED;
        }
        if (isOnCooldown(userId.get())) {
            return ChangeEmailOutcome.CODE_ON_COOLDOWN;
        }

        try {
            String code = generateCode();
            emailChangeCodeRepository.upsertCode(userId.get(), newEmail, code, codeExpiry());
            mailer.sendEmailChangeCode(newEmail, code);
            try {
                mailer.sendEmailChangeNotice(user.email(), newEmail);
            } catch (Exception e) {
                // Уведомление на старый адрес не критично для самого
                // запроса — не роняем его из-за временной проблемы с
                // почтой, как и Node.
                log.warn("stats-backend-java: ошибка отправки уведомления о запросе смены email", e);
            }
            return ChangeEmailOutcome.OK;
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка запроса смены email", e);
            return ChangeEmailOutcome.INTERNAL_ERROR;
        }
    }

    @Override
    public ResendEmailChangeCodeOutcome resendEmailChangeCode(String cookieValue) {
        Optional<String> userId = resolveUserId(cookieValue);
        if (userId.isEmpty()) {
            return ResendEmailChangeCodeOutcome.UNAUTHORIZED;
        }

        Optional<EmailChangeCode> pending = emailChangeCodeRepository.getCode(userId.get());
        if (pending.isEmpty()) {
            return ResendEmailChangeCodeOutcome.NO_PENDING_CHANGE;
        }
        if (isOnCooldown(userId.get())) {
            return ResendEmailChangeCodeOutcome.CODE_ON_COOLDOWN;
        }

        try {
            String code = generateCode();
            emailChangeCodeRepository.upsertCode(userId.get(), pending.get().newEmail(), code, codeExpiry());
            mailer.sendEmailChangeCode(pending.get().newEmail(), code);
            return ResendEmailChangeCodeOutcome.OK;
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка повторной отправки кода смены email", e);
            return ResendEmailChangeCodeOutcome.INTERNAL_ERROR;
        }
    }

    @Override
    public ConfirmEmailChangeResult confirmEmailChange(String cookieValue, String rawCode) {
        Optional<String> userId = resolveUserId(cookieValue);
        if (userId.isEmpty()) {
            return ConfirmEmailChangeResult.error(ConfirmEmailChangeOutcome.UNAUTHORIZED);
        }
        String code = rawCode == null ? "" : rawCode.trim();
        if (code.isEmpty()) {
            return ConfirmEmailChangeResult.error(ConfirmEmailChangeOutcome.INVALID_REQUEST);
        }

        Optional<EmailChangeCode> maybeRow = emailChangeCodeRepository.getCode(userId.get());
        if (maybeRow.isEmpty()) {
            return ConfirmEmailChangeResult.error(ConfirmEmailChangeOutcome.CODE_NOT_FOUND);
        }
        EmailChangeCode row = maybeRow.get();
        if (Instant.now().isAfter(row.expiresAt())) {
            emailChangeCodeRepository.deleteCode(userId.get());
            return ConfirmEmailChangeResult.error(ConfirmEmailChangeOutcome.CODE_EXPIRED);
        }
        if (row.attempts() >= MAX_ATTEMPTS) {
            return ConfirmEmailChangeResult.error(ConfirmEmailChangeOutcome.TOO_MANY_ATTEMPTS);
        }
        if (!code.equals(row.code())) {
            emailChangeCodeRepository.registerFailedAttempt(userId.get());
            return ConfirmEmailChangeResult.error(ConfirmEmailChangeOutcome.WRONG_CODE);
        }

        // Второй игрок мог занять этот email между запросом смены и
        // подтверждением кода — перепроверяем прямо перед записью.
        Optional<User> conflicting = userRepository.findByEmail(row.newEmail());
        if (conflicting.isPresent() && !conflicting.get().id().equals(userId.get())) {
            emailChangeCodeRepository.deleteCode(userId.get());
            return ConfirmEmailChangeResult.error(ConfirmEmailChangeOutcome.EMAIL_ALREADY_REGISTERED);
        }

        Optional<User> before = userRepository.findById(userId.get());
        Optional<User> updated = userRepository.updateEmail(userId.get(), row.newEmail());
        emailChangeCodeRepository.deleteCode(userId.get());
        if (before.isEmpty() || updated.isEmpty()) {
            return ConfirmEmailChangeResult.error(ConfirmEmailChangeOutcome.INTERNAL_ERROR);
        }

        try {
            mailer.sendEmailChanged(before.get().email(), before.get().email(), updated.get().email());
            mailer.sendEmailChanged(updated.get().email(), before.get().email(), updated.get().email());
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка отправки подтверждения смены email", e);
        }

        return new ConfirmEmailChangeResult(ConfirmEmailChangeOutcome.OK, updated.get().email());
    }

    @Override
    public ChangePasswordOutcome changePassword(
            String cookieValue, String currentPassword, String newPassword, String clientIp) {
        Optional<String> userId = resolveUserId(cookieValue);
        if (userId.isEmpty()) {
            return ChangePasswordOutcome.UNAUTHORIZED;
        }
        if (!Validation.isValidPassword(newPassword)) {
            return ChangePasswordOutcome.INVALID_PASSWORD;
        }

        Optional<User> maybeUser = userRepository.findById(userId.get());
        if (maybeUser.isEmpty() || !passwordHasher.verify(currentPassword, maybeUser.get().passwordHash())) {
            return ChangePasswordOutcome.WRONG_PASSWORD;
        }

        Optional<User> updated = userRepository.updatePasswordHash(userId.get(), passwordHasher.hash(newPassword));
        if (updated.isEmpty()) {
            return ChangePasswordOutcome.INTERNAL_ERROR;
        }

        try {
            Location location = geoLookup.lookup(clientIp);
            mailer.sendPasswordChanged(
                    updated.get().email(), clientIp, location.country(), location.city(), UtcTime.now());
        } catch (Exception e) {
            log.warn("stats-backend-java: ошибка отправки уведомления о смене пароля", e);
        }

        return ChangePasswordOutcome.OK;
    }

    @Override
    public LoginHistoryResult loginHistory(String cookieValue) {
        Optional<String> userId = resolveUserId(cookieValue);
        if (userId.isEmpty()) {
            return LoginHistoryResult.unauthorized();
        }

        List<LoginEventView> events = loginEventRepository.listRecent(userId.get(), LOGIN_HISTORY_LIMIT).stream()
                .map(this::toView)
                .toList();
        return new LoginHistoryResult(LoginHistoryOutcome.OK, events);
    }

    private LoginEventView toView(LoginEvent event) {
        return new LoginEventView(
                event.id(), event.ip(), event.country(), event.city(), UtcTime.format(event.createdAt()));
    }

    private Optional<String> resolveUserId(String cookieValue) {
        if (cookieValue == null) {
            return Optional.empty();
        }
        return sessionCodec.decrypt(cookieValue).map(Session::userId).filter(id -> id != null);
    }

    private boolean isOnCooldown(String userId) {
        return emailChangeCodeRepository
                .getCode(userId)
                .map(row -> row.createdAt().isAfter(Instant.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .orElse(false);
    }

    private static Instant codeExpiry() {
        return Instant.now().plus(CODE_TTL_MINUTES, ChronoUnit.MINUTES);
    }

    private String generateCode() {
        return String.valueOf(100000 + secureRandom.nextInt(900000));
    }
}
