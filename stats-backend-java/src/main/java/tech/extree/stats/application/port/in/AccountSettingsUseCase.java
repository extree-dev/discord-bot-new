package tech.extree.stats.application.port.in;

import java.util.List;

/**
 * Соответствует /auth/account/change-email, /resend-email-change-code,
 * /confirm-email-change, /auth/account/change-password,
 * /api/account/login-history в server.js. Все методы принимают cookieValue
 * сессии как первый аргумент (тот же приём, что GetSessionUseCase/
 * GetAccountUseCase) — "step-up" проверка (действующая сессия И текущий
 * пароль для смены учётных данных), см. requireSession в server.js.
 */
public interface AccountSettingsUseCase {

    enum ChangeEmailOutcome {
        OK,
        UNAUTHORIZED,
        INVALID_EMAIL,
        WRONG_PASSWORD,
        SAME_EMAIL,
        EMAIL_ALREADY_REGISTERED,
        CODE_ON_COOLDOWN,
        INTERNAL_ERROR
    }

    ChangeEmailOutcome changeEmail(String cookieValue, String currentPassword, String newEmail);

    enum ResendEmailChangeCodeOutcome {
        OK,
        UNAUTHORIZED,
        NO_PENDING_CHANGE,
        CODE_ON_COOLDOWN,
        INTERNAL_ERROR
    }

    ResendEmailChangeCodeOutcome resendEmailChangeCode(String cookieValue);

    enum ConfirmEmailChangeOutcome {
        OK,
        UNAUTHORIZED,
        INVALID_REQUEST,
        CODE_NOT_FOUND,
        CODE_EXPIRED,
        TOO_MANY_ATTEMPTS,
        WRONG_CODE,
        EMAIL_ALREADY_REGISTERED,
        INTERNAL_ERROR
    }

    record ConfirmEmailChangeResult(ConfirmEmailChangeOutcome outcome, String email) {
        public static ConfirmEmailChangeResult error(ConfirmEmailChangeOutcome outcome) {
            return new ConfirmEmailChangeResult(outcome, null);
        }
    }

    ConfirmEmailChangeResult confirmEmailChange(String cookieValue, String code);

    enum ChangePasswordOutcome {
        OK,
        UNAUTHORIZED,
        INVALID_PASSWORD,
        WRONG_PASSWORD,
        INTERNAL_ERROR
    }

    ChangePasswordOutcome changePassword(String cookieValue, String currentPassword, String newPassword, String clientIp);

    enum LoginHistoryOutcome {
        OK,
        UNAUTHORIZED
    }

    record LoginEventView(String id, String ip, String country, String city, String time) {}

    record LoginHistoryResult(LoginHistoryOutcome outcome, List<LoginEventView> events) {
        public static LoginHistoryResult unauthorized() {
            return new LoginHistoryResult(LoginHistoryOutcome.UNAUTHORIZED, List.of());
        }
    }

    LoginHistoryResult loginHistory(String cookieValue);
}
