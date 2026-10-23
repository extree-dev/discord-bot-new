package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.ForgotPasswordRequest;
import tech.extree.stats.adapter.in.web.dto.LoginResponse;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.adapter.in.web.dto.ResetPasswordRequest;
import tech.extree.stats.application.port.in.PasswordResetUseCase;

/** Соответствует /auth/forgot-password, /auth/reset-password в server.js. */
@RestController
public class PasswordResetController {

    private final PasswordResetUseCase passwordResetUseCase;

    public PasswordResetController(PasswordResetUseCase passwordResetUseCase) {
        this.passwordResetUseCase = passwordResetUseCase;
    }

    @PostMapping("/auth/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest request, HttpServletRequest httpRequest) {
        PasswordResetUseCase.ForgotPasswordOutcome outcome =
                passwordResetUseCase.forgotPassword(request.email(), httpRequest.getHeader(HttpHeaders.HOST));
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case INVALID_EMAIL -> badRequest("invalid_email");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
        };
    }

    @PostMapping("/auth/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request, HttpServletRequest httpRequest) {
        PasswordResetUseCase.ResetPasswordResult result =
                passwordResetUseCase.resetPassword(request.token(), request.password(), ClientIp.from(httpRequest), httpRequest.getHeader("User-Agent"));
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, SessionCookies.build(result.sessionCookie(), true).toString())
                    .body(new LoginResponse(true, new LoginResponse.LoginUser(result.email())));
            case INVALID_REQUEST -> badRequest("invalid_request");
            case INVALID_PASSWORD -> badRequest("invalid_password");
            case TOKEN_NOT_FOUND -> badRequest("token_not_found");
            case TOKEN_EXPIRED -> badRequest("token_expired");
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
