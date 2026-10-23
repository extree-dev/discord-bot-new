package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ChangeEmailRequest;
import tech.extree.stats.adapter.in.web.dto.ChangePasswordRequest;
import tech.extree.stats.adapter.in.web.dto.CodeRequest;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.adapter.in.web.dto.VerifyResponse;
import tech.extree.stats.application.port.in.AccountSettingsUseCase;

/**
 * Соответствует requireSession + /auth/account/change-email,
 * /resend-email-change-code, /confirm-email-change,
 * /auth/account/change-password в server.js.
 *
 * GET /api/account/login-history удалён из этого контроллера —
 * он дублирует LoginEventController#history (Ambiguous mapping
 * на старте Spring Boot). Вся логика login-history — в
 * LoginEventController.
 */
@RestController
public class AccountSettingsController {

    private final AccountSettingsUseCase accountSettingsUseCase;

    public AccountSettingsController(AccountSettingsUseCase accountSettingsUseCase) {
        this.accountSettingsUseCase = accountSettingsUseCase;
    }

    @PostMapping("/auth/account/change-email")
    public ResponseEntity<?> changeEmail(
            @RequestBody ChangeEmailRequest request,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AccountSettingsUseCase.ChangeEmailOutcome outcome =
                accountSettingsUseCase.changeEmail(cookie, request.currentPassword(), request.newEmail());
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case INVALID_EMAIL -> badRequest("invalid_email");
            case WRONG_PASSWORD -> status(HttpStatus.UNAUTHORIZED, "wrong_password");
            case SAME_EMAIL -> badRequest("same_email");
            case EMAIL_ALREADY_REGISTERED -> status(HttpStatus.CONFLICT, "email_already_registered");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
            case INTERNAL_ERROR -> internalError();
        };
    }

    @PostMapping("/auth/account/resend-email-change-code")
    public ResponseEntity<?> resendEmailChangeCode(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AccountSettingsUseCase.ResendEmailChangeCodeOutcome outcome =
                accountSettingsUseCase.resendEmailChangeCode(cookie);
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case NO_PENDING_CHANGE -> badRequest("no_pending_change");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
            case INTERNAL_ERROR -> internalError();
        };
    }

    @PostMapping("/auth/account/confirm-email-change")
    public ResponseEntity<?> confirmEmailChange(
            @RequestBody CodeRequest request,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AccountSettingsUseCase.ConfirmEmailChangeResult result =
                accountSettingsUseCase.confirmEmailChange(cookie, request.code());
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(new VerifyResponse(true, new VerifyResponse.VerifyUser(result.email())));
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case INVALID_REQUEST -> badRequest("invalid_request");
            case CODE_NOT_FOUND -> badRequest("code_not_found");
            case CODE_EXPIRED -> badRequest("code_expired");
            case TOO_MANY_ATTEMPTS -> status(HttpStatus.TOO_MANY_REQUESTS, "too_many_attempts");
            case WRONG_CODE -> badRequest("wrong_code");
            case EMAIL_ALREADY_REGISTERED -> status(HttpStatus.CONFLICT, "email_already_registered");
            case INTERNAL_ERROR -> internalError();
        };
    }

    @PostMapping("/auth/account/change-password")
    public ResponseEntity<?> changePassword(
            @RequestBody ChangePasswordRequest request,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie,
            HttpServletRequest httpRequest) {
        AccountSettingsUseCase.ChangePasswordOutcome outcome = accountSettingsUseCase.changePassword(
                cookie, request.currentPassword(), request.newPassword(), ClientIp.from(httpRequest));
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case INVALID_PASSWORD -> badRequest("invalid_password");
            case WRONG_PASSWORD -> status(HttpStatus.UNAUTHORIZED, "wrong_password");
            case INTERNAL_ERROR -> internalError();
        };
    }

    private static ResponseEntity<ErrorResponse> badRequest(String error) {
        return status(HttpStatus.BAD_REQUEST, error);
    }

    private static ResponseEntity<ErrorResponse> internalError() {
        return status(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error");
    }

    private static ResponseEntity<ErrorResponse> status(HttpStatus status, String error) {
        return ResponseEntity.status(status).body(new ErrorResponse(error));
    }
}