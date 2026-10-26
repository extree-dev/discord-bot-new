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
        /** Токен и пароль валидны, но на аккаунте включена 2FA — нужно
         * повторить запрос с тем же token+password и добавленным totpCode. */
        TOTP_REQUIRED,
        TOTP_INVALID,
        TOO_MANY_ATTEMPTS,
        INTERNAL_ERROR
    }

    record ResetPasswordResult(ResetPasswordOutcome outcome, String email, String sessionCookie) {
        public static ResetPasswordResult error(ResetPasswordOutcome outcome) {
            return new ResetPasswordResult(outcome, null, null);
        }
    }

    /**
     * Успешный сброс сразу логинит (как и Node) — sessionCookie заполнен
     * только при OK. Если на аккаунте включена 2FA, пароль не меняется и
     * токен не удаляется, пока не придёт верный totpCode (6-значный TOTP
     * или recovery-код) — иначе сброс пароля через письмо полностью
     * обходил бы второй фактор.
     */
    ResetPasswordResult resetPassword(String token, String newPassword, String totpCode, String clientIp, String userAgent);
}
