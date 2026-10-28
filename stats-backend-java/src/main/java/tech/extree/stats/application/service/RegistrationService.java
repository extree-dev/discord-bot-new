package tech.extree.stats.application.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.Validation;
import tech.extree.stats.application.port.in.RegistrationUseCase;
import tech.extree.stats.application.port.out.EmailCodeRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.EmailCode;
import tech.extree.stats.domain.NicknameTakenException;
import tech.extree.stats.domain.User;

@Service
public class RegistrationService implements RegistrationUseCase {

    private static final Logger log = LoggerFactory.getLogger(RegistrationService.class);

    private static final long CODE_TTL_MINUTES = 10;
    private static final long RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;

    // Только при extree.local-dev-bypass=true (профиль dev) — принимает
    // этот код вместо настоящего из письма подтверждения (письма в dev не
    // отправляются, см. DevMailer).
    private static final String LOCAL_DEV_BYPASS_CODE = "000000";

    private final UserRepository userRepository;
    private final EmailCodeRepository emailCodeRepository;
    private final PasswordHasher passwordHasher;
    private final Mailer mailer;
    private final PasswordPolicyService passwordPolicy;
    private final SessionRepository sessionRepository;
    private final boolean localDevBypass;
    private final SecureRandom secureRandom = new SecureRandom();

    public RegistrationService(
            UserRepository userRepository,
            EmailCodeRepository emailCodeRepository,
            PasswordHasher passwordHasher,
            Mailer mailer,
            PasswordPolicyService passwordPolicy,
            SessionRepository sessionRepository,
            @Value("${extree.local-dev-bypass:false}") boolean localDevBypass) {
        this.userRepository = userRepository;
        this.emailCodeRepository = emailCodeRepository;
        this.passwordHasher = passwordHasher;
        this.mailer = mailer;
        this.sessionRepository = sessionRepository;
        this.passwordPolicy = passwordPolicy;
        this.localDevBypass = localDevBypass;
    }

    @Override
    public RegisterOutcome register(String rawEmail, String password, String rawName, String rawNickname) {
        String email = Validation.normalizeEmail(rawEmail);
        String name = rawName == null ? "" : rawName.trim();
        String nickname = rawNickname == null ? "" : rawNickname.trim();

        if (!Validation.isValidEmail(email)) {
            return RegisterOutcome.INVALID_EMAIL;
        }
        if (!Validation.isValidPassword(password)) {
            return RegisterOutcome.INVALID_PASSWORD;
        }
        PasswordPolicyService.Result pp = passwordPolicy.validate(password, email, name, nickname);
        if (!pp.valid()) {
            return "password_breached".equals(pp.reason())
                    ? RegisterOutcome.INVALID_PASSWORD  // TODO: отдельный outcome, если надо различать
                    : RegisterOutcome.INVALID_PASSWORD;
        }
        if (!Validation.isValidName(name)) {
            return RegisterOutcome.INVALID_NAME;
        }
        if (!Validation.isValidNickname(nickname)) {
            return RegisterOutcome.INVALID_NICKNAME;
        }

        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            if (existing.get().isBanned()) {
                return RegisterOutcome.BANNED;
            }
            if (existing.get().emailVerified()) {
                return RegisterOutcome.EMAIL_ALREADY_REGISTERED;
            }
        }
        if (isOnCooldown(email)) {
            return RegisterOutcome.CODE_ON_COOLDOWN;
        }

        try {
            userRepository.upsertUnverifiedUser(email, passwordHasher.hash(password), name, nickname);
        } catch (NicknameTakenException e) {
            return RegisterOutcome.NICKNAME_TAKEN;
        } catch (Exception e) {
            log.error("stats-backend-java: ошибка сохранения пользователя {}", email, e);
            return RegisterOutcome.INTERNAL_ERROR;
        }

        try {
            issueAndSendCode(email);
        } catch (Exception e) {
            log.error("stats-backend-java: не удалось отправить код подтверждения на {}", email, e);
            return RegisterOutcome.INTERNAL_ERROR;
        }
        return RegisterOutcome.OK;
    }

    @Override
    public ResendOutcome resendCode(String rawEmail) {
        String email = Validation.normalizeEmail(rawEmail);
        if (!Validation.isValidEmail(email)) {
            return ResendOutcome.INVALID_EMAIL;
        }

        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isEmpty() || existing.get().emailVerified()) {
            return ResendOutcome.OK;
        }
        if (isOnCooldown(email)) {
            return ResendOutcome.CODE_ON_COOLDOWN;
        }

        try {
            issueAndSendCode(email);
        } catch (Exception e) {
            return ResendOutcome.INTERNAL_ERROR;
        }
        return ResendOutcome.OK;
    }

    @Override
    public VerifyResult verify(String rawEmail, String rawCode, String clientIp, String userAgent) {
        String email = Validation.normalizeEmail(rawEmail);
        String code = rawCode == null ? "" : rawCode.trim();
        if (!Validation.isValidEmail(email) || code.isEmpty()) {
            return VerifyResult.error(VerifyOutcome.INVALID_REQUEST);
        }

        Optional<EmailCode> row = emailCodeRepository.getCode(email);
        if (row.isEmpty()) {
            return VerifyResult.error(VerifyOutcome.CODE_NOT_FOUND);
        }
        EmailCode pending = row.get();
        if (Instant.now().isAfter(pending.expiresAt())) {
            emailCodeRepository.deleteCode(email);
            return VerifyResult.error(VerifyOutcome.CODE_EXPIRED);
        }
        if (pending.attempts() >= MAX_ATTEMPTS) {
            return VerifyResult.error(VerifyOutcome.TOO_MANY_ATTEMPTS);
        }
        boolean isDevBypassCode = localDevBypass && LOCAL_DEV_BYPASS_CODE.equals(code);
        if (!code.equals(pending.code()) && !isDevBypassCode) {
            emailCodeRepository.registerFailedAttempt(email);
            return VerifyResult.error(VerifyOutcome.WRONG_CODE);
        }

        Optional<User> verified = userRepository.markEmailVerified(email);
        emailCodeRepository.deleteCode(email);
        if (verified.isEmpty()) {
            return VerifyResult.error(VerifyOutcome.INTERNAL_ERROR);
        }

        SessionRepository.Created session =
                sessionRepository.create(null, verified.get().id(), clientIp, userAgent, true);
        return new VerifyResult(VerifyOutcome.OK, verified.get().email(), session.token());
    }

    private boolean isOnCooldown(String email) {
        return emailCodeRepository
                .getCode(email)
                .map(row -> row.createdAt().isAfter(Instant.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .orElse(false);
    }

    private void issueAndSendCode(String email) {
        String code = generateCode();
        emailCodeRepository.upsertCode(email, code, Instant.now().plus(CODE_TTL_MINUTES, ChronoUnit.MINUTES));
        mailer.sendVerificationCode(email, code);
    }

    private String generateCode() {
        return String.valueOf(100000 + secureRandom.nextInt(900000));
    }
}