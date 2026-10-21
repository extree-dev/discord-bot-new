package tech.extree.stats.application.port.in;

/** Соответствует /auth/forgot-password, /auth/reset-password в server.js. */
public interface PasswordResetUseCase {

    enum ForgotPasswordOutcome {
        OK,
        INVALID_EMAIL,
        CODE_ON_COOLDOWN
    }

    /**
     * requestHost — Host-заголовок запроса, для ссылки сброса
     * (resetUrlFor в server.js: https://{host}/reset-password?token=...).
     * OK возвращается даже если аккаунта с таким email нет и даже при
     * сбое отправки письма — тот же анти-перебор приём, что у Node.
     */
    ForgotPasswordOutcome forgotPassword(String email, String requestHost);

    enum ResetPasswordOutcome {
        OK,
        INVALID_REQUEST,
        INVALID_PASSWORD,
        TOKEN_NOT_FOUND,
        TOKEN_EXPIRED,
        INTERNAL_ERROR
    }

    record ResetPasswordResult(ResetPasswordOutcome outcome, String email, String sessionCookie) {
        public static ResetPasswordResult error(ResetPasswordOutcome outcome) {
            return new ResetPasswordResult(outcome, null, null);
        }
    }

    /** Успешный сброс сразу логинит (как и Node) — sessionCookie заполнен только при OK. */
    ResetPasswordResult resetPassword(String token, String newPassword, String clientIp);
}
