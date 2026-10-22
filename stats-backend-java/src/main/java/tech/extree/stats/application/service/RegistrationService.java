package tech.extree.stats.application.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.Validation;
import tech.extree.stats.application.port.in.RegistrationUseCase;
import tech.extree.stats.application.port.out.EmailCodeRepository;
import tech.extree.stats.application.port.out.Mailer;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.EmailCode;
import tech.extree.stats.domain.NicknameTakenException;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

@Service
public class RegistrationService implements RegistrationUseCase {

    private static final long CODE_TTL_MINUTES = 10;
    private static final long RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;

    private final UserRepository userRepository;
    private final EmailCodeRepository emailCodeRepository;
    private final PasswordHasher passwordHasher;
    private final Mailer mailer;
    private final SessionCodec sessionCodec;
    private final SecureRandom secureRandom = new SecureRandom();

    public RegistrationService(
            UserRepository userRepository,
            EmailCodeRepository emailCodeRepository,
            PasswordHasher passwordHasher,
            Mailer mailer,
            SessionCodec sessionCodec) {
        this.userRepository = userRepository;
        this.emailCodeRepository = emailCodeRepository;
        this.passwordHasher = passwordHasher;
        this.mailer = mailer;
        this.sessionCodec = sessionCodec;
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
        if (!Validation.isValidName(name)) {
            return RegisterOutcome.INVALID_NAME;
        }
        if (!Validation.isValidNickname(nickname)) {
            return RegisterOutcome.INVALID_NICKNAME;
        }

        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent() && existing.get().emailVerified()) {
            return RegisterOutcome.EMAIL_ALREADY_REGISTERED;
        }
        if (isOnCooldown(email)) {
            return RegisterOutcome.CODE_ON_COOLDOWN;
        }

        try {
            userRepository.upsertUnverifiedUser(email, passwordHasher.hash(password), name, nickname);
        } catch (NicknameTakenException e) {
            return RegisterOutcome.NICKNAME_TAKEN;
        } catch (Exception e) {
            System.err.println("!!! ОШИБКА ПРИ СОХРАНЕНИИ ПОЛЬЗОВАТЕЛЯ: " + e.getMessage());
            e.printStackTrace(); // <-- ВЫВЕДЕТ ОШИБКУ В ЛОГ
            return RegisterOutcome.INTERNAL_ERROR;
        }

        try {
            issueAndSendCode(email);
        } catch (Exception e) {
            System.err.println("!!! ОШИБКА ПРИ ОТПРАВКЕ EMAIL: " + e.getMessage());
            e.printStackTrace(); // <-- ВЫВЕДЕТ ОШИБКУ В ЛОГ
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
            e.printStackTrace();
            return ResendOutcome.INTERNAL_ERROR;
        }
        return ResendOutcome.OK;
    }

    @Override
    public VerifyResult verify(String rawEmail, String rawCode) {
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
        if (!code.equals(pending.code())) {
            emailCodeRepository.registerFailedAttempt(email);
            return VerifyResult.error(VerifyOutcome.WRONG_CODE);
        }

        Optional<User> verified = userRepository.markEmailVerified(email);
        emailCodeRepository.deleteCode(email);
        if (verified.isEmpty()) {
            return VerifyResult.error(VerifyOutcome.INTERNAL_ERROR);
        }

        String cookie = sessionCodec.encrypt(new Session(null, verified.get().id(), System.currentTimeMillis()));
        return new VerifyResult(VerifyOutcome.OK, verified.get().email(), cookie);
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