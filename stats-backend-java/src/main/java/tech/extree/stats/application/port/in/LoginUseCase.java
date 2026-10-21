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
        INTERNAL_ERROR
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
        INTERNAL_ERROR
    }

    enum ConfirmLocationOutcome {
        OK,
        INVALID_REQUEST,
        CODE_NOT_FOUND,
        CODE_EXPIRED,
        TOO_MANY_ATTEMPTS,
        WRONG_CODE,
        INTERNAL_ERROR
    }

    /**
     * remember — значение, сохранённое в stats_login_codes на момент
     * исходной попытки входа (row.remember в Node), а не из этого
     * запроса: контроллер использует его для Max-Age cookie.
     */
    record ConfirmLocationResult(ConfirmLocationOutcome outcome, String email, String sessionCookie, boolean remember) {
        public static ConfirmLocationResult error(ConfirmLocationOutcome outcome) {
            return new ConfirmLocationResult(outcome, null, null, false);
        }
    }

    LoginResult login(String email, String password, String turnstileToken, String clientIp, boolean rememberMe);

    ResendLoginCodeOutcome resendCode(String email);

    ConfirmLocationResult confirmLocation(String email, String code);
}
