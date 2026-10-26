package tech.extree.stats.application.port.in;

/** Соответствует /auth/login, /auth/login/resend-code, /auth/login/confirm-location в server.js. */
public interface LoginUseCase {

    enum LoginOutcome {
        OK,
        TURNSTILE_FAILED,
        INVALID_REQUEST,
        INVALID_CREDENTIALS,
        EMAIL_NOT_VERIFIED,
        UNKNOWN_LOCATION,
        CODE_ON_COOLDOWN,
        INTERNAL_ERROR,
        BANNED,
        TOO_MANY_ATTEMPTS,
        REQUIRES_2FA
    }

    /** sessionCookie заполнен только при OK. */
    record LoginResult(LoginOutcome outcome, String email, String sessionCookie) {
        public static LoginResult error(LoginOutcome outcome) {
            return new LoginResult(outcome, null, null);
        }
    }

    enum ResendLoginCodeOutcome {
        OK,
        INVALID_EMAIL,
        CODE_ON_COOLDOWN,
        INTERNAL_ERROR,
        BANNED
    }

    enum ConfirmLocationOutcome {
        OK,
        INVALID_REQUEST,
        CODE_NOT_FOUND,
        CODE_EXPIRED,
        TOO_MANY_ATTEMPTS,
        WRONG_CODE,
        INTERNAL_ERROR,
        BANNED
    }

    record ConfirmLocationResult(ConfirmLocationOutcome outcome, String email, String sessionCookie, boolean remember) {
        public static ConfirmLocationResult error(ConfirmLocationOutcome outcome) {
            return new ConfirmLocationResult(outcome, null, null, false);
        }
    }

    record Verify2faResult(Verify2faOutcome outcome, String email, String sessionCookie, boolean remember) {
        public static Verify2faResult error(Verify2faOutcome outcome) {
            return new Verify2faResult(outcome, null, null, false);
        }
    }

    enum Verify2faOutcome {
        OK,
        INVALID_REQUEST,
        PRE_2FA_EXPIRED,
        TOTP_INVALID,
        INTERNAL_ERROR,
        BANNED,
        TOO_MANY_ATTEMPTS
    }

    LoginResult login(String email, String password, String turnstileToken, String clientIp, String userAgent, boolean rememberMe);

    ResendLoginCodeOutcome resendCode(String email);

    ConfirmLocationResult confirmLocation(String email, String code, String userAgent);

    /** Второй шаг 2FA: pre2faToken из cookie + totpCode. */
    Verify2faResult verify2fa(String pre2faToken, String totpCode);
}