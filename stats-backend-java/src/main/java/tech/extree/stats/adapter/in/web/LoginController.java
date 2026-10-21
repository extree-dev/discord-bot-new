package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.LoginRequest;
import tech.extree.stats.adapter.in.web.dto.LoginResponse;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.adapter.in.web.dto.ResendCodeRequest;
import tech.extree.stats.adapter.in.web.dto.VerifyRequest;
import tech.extree.stats.application.port.in.LoginUseCase;

/**
 * Соответствует /auth/login, /auth/login/resend-code,
 * /auth/login/confirm-location в server.js — см. LoginService для логики
 * "известного места входа". VerifyRequest (email+code) переиспользован
 * для confirm-location — структурно то же тело, что у /auth/verify.
 */
@RestController
public class LoginController {

    private final LoginUseCase loginUseCase;

    public LoginController(LoginUseCase loginUseCase) {
        this.loginUseCase = loginUseCase;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        boolean rememberMe = request.rememberMeOrDefault();
        LoginUseCase.LoginResult result = loginUseCase.login(
                request.email(), request.password(), request.turnstileToken(), ClientIp.from(httpRequest), rememberMe);
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, SessionCookies.build(result.sessionCookie(), rememberMe).toString())
                    .body(new LoginResponse(true, new LoginResponse.LoginUser(result.email())));
            case TURNSTILE_FAILED -> badRequest("turnstile_failed");
            case INVALID_REQUEST -> badRequest("invalid_request");
            case INVALID_CREDENTIALS -> status(HttpStatus.UNAUTHORIZED, "invalid_credentials");
            case EMAIL_NOT_VERIFIED -> status(HttpStatus.FORBIDDEN, "email_not_verified");
            case UNKNOWN_LOCATION -> status(HttpStatus.FORBIDDEN, "unknown_location");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
            case INTERNAL_ERROR -> internalError();
        };
    }

    @PostMapping("/auth/login/resend-code")
    public ResponseEntity<?> resendCode(@RequestBody ResendCodeRequest request) {
        LoginUseCase.ResendLoginCodeOutcome outcome = loginUseCase.resendCode(request.email());
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case INVALID_EMAIL -> badRequest("invalid_email");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
            case INTERNAL_ERROR -> internalError();
        };
    }

    @PostMapping("/auth/login/confirm-location")
    public ResponseEntity<?> confirmLocation(@RequestBody VerifyRequest request) {
        LoginUseCase.ConfirmLocationResult result = loginUseCase.confirmLocation(request.email(), request.code());
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok()
                    .header(
                            HttpHeaders.SET_COOKIE,
                            SessionCookies.build(result.sessionCookie(), result.remember()).toString())
                    .body(new LoginResponse(true, new LoginResponse.LoginUser(result.email())));
            case INVALID_REQUEST -> badRequest("invalid_request");
            case CODE_NOT_FOUND -> badRequest("code_not_found");
            case CODE_EXPIRED -> badRequest("code_expired");
            case TOO_MANY_ATTEMPTS -> status(HttpStatus.TOO_MANY_REQUESTS, "too_many_attempts");
            case WRONG_CODE -> badRequest("wrong_code");
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
