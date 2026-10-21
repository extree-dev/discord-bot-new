package tech.extree.stats.adapter.in.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.adapter.in.web.dto.RegisterRequest;
import tech.extree.stats.adapter.in.web.dto.ResendCodeRequest;
import tech.extree.stats.adapter.in.web.dto.VerifyRequest;
import tech.extree.stats.adapter.in.web.dto.VerifyResponse;
import tech.extree.stats.application.port.in.RegistrationUseCase;

/**
 * Соответствует /auth/register, /auth/resend-code, /auth/verify в
 * server.js — HTTP-статусы и snake_case error-коды повторены один в
 * один, см. RegistrationService для самой логики. Как и Node,
 * verify() сразу логинит (ставит cookie), без отдельного /auth/login.
 */
@RestController
public class AuthController {

    private final RegistrationUseCase registrationUseCase;

    public AuthController(RegistrationUseCase registrationUseCase) {
        this.registrationUseCase = registrationUseCase;
    }

    @PostMapping("/auth/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        RegistrationUseCase.RegisterOutcome outcome = registrationUseCase.register(
                request.email(), request.password(), request.name(), request.nickname());
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case INVALID_EMAIL -> badRequest("invalid_email");
            case INVALID_PASSWORD -> badRequest("invalid_password");
            case INVALID_NAME -> badRequest("invalid_name");
            case INVALID_NICKNAME -> badRequest("invalid_nickname");
            case EMAIL_ALREADY_REGISTERED -> status(HttpStatus.CONFLICT, "email_already_registered");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
            case NICKNAME_TAKEN -> status(HttpStatus.CONFLICT, "nickname_taken");
            case INTERNAL_ERROR -> internalError();
        };
    }

    @PostMapping("/auth/resend-code")
    public ResponseEntity<?> resendCode(@RequestBody ResendCodeRequest request) {
        RegistrationUseCase.ResendOutcome outcome = registrationUseCase.resendCode(request.email());
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case INVALID_EMAIL -> badRequest("invalid_email");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
            case INTERNAL_ERROR -> internalError();
        };
    }

    @PostMapping("/auth/verify")
    public ResponseEntity<?> verify(@RequestBody VerifyRequest request) {
        RegistrationUseCase.VerifyResult result = registrationUseCase.verify(request.email(), request.code());
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, SessionCookies.build(result.sessionCookie(), true).toString())
                    .body(new VerifyResponse(true, new VerifyResponse.VerifyUser(result.email())));
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
