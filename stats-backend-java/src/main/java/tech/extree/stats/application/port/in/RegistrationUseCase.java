package tech.extree.stats.application.port.in;

/** Соответствует /auth/register, /auth/resend-code, /auth/verify в server.js. */
public interface RegistrationUseCase {

    enum RegisterOutcome {
        OK,
        INVALID_EMAIL,
        INVALID_PASSWORD,
        INVALID_NAME,
        INVALID_NICKNAME,
        EMAIL_ALREADY_REGISTERED,
        CODE_ON_COOLDOWN,
        NICKNAME_TAKEN,
        INTERNAL_ERROR,
        BANNED
    }

    enum ResendOutcome {
        OK,
        INVALID_EMAIL,
        CODE_ON_COOLDOWN,
        INTERNAL_ERROR
    }

    /** sessionCookie заполнен только при OK — контроллер выставляет его пользователю. */
    record VerifyResult(VerifyOutcome outcome, String email, String sessionCookie) {
        public static VerifyResult error(VerifyOutcome outcome) {
            return new VerifyResult(outcome, null, null);
        }
    }

    enum VerifyOutcome {
        OK,
        INVALID_REQUEST,
        CODE_NOT_FOUND,
        CODE_EXPIRED,
        TOO_MANY_ATTEMPTS,
        WRONG_CODE,
        INTERNAL_ERROR
    }

    RegisterOutcome register(String email, String password, String name, String nickname);

    ResendOutcome resendCode(String email);

    VerifyResult verify(String email, String code, String clientIp, String userAgent);
}
