package tech.extree.stats.adapter.in.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.CreateTicketRequest;
import tech.extree.stats.adapter.in.web.dto.CreateTicketResponse;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.MessageRequest;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.application.port.in.SupportTicketUseCase;

/**
 * Соответствует POST /api/support/tickets, GET /api/support/tickets/:token,
 * POST /api/support/tickets/:token/reply в server.js — публичная сторона
 * тикет-платформы (без входа, или с сессией, но без прав админа).
 */
@RestController
public class SupportTicketController {

    private final SupportTicketUseCase supportTicketUseCase;
    private final String publicHost;

    public SupportTicketController(
            SupportTicketUseCase supportTicketUseCase, @Value("${extree.public-host}") String publicHost) {
        this.supportTicketUseCase = supportTicketUseCase;
        this.publicHost = publicHost;
    }

    @PostMapping("/api/support/tickets")
    public ResponseEntity<?> createTicket(
            @RequestBody CreateTicketRequest request,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        SupportTicketUseCase.CreateResult result = supportTicketUseCase.createTicket(
                cookie, request.email(), request.subject(), request.message(), request.category(), publicHost);
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(new CreateTicketResponse(true, result.ticketNumber()));
            case INVALID_REQUEST -> status(HttpStatus.UNAUTHORIZED, "invalid_request");
            case INVALID_EMAIL -> badRequest("invalid_email");
            case INVALID_SUBJECT -> badRequest("invalid_subject");
            case INVALID_MESSAGE -> badRequest("invalid_message");
            case INVALID_CATEGORY -> badRequest("invalid_category");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
            case INTERNAL_ERROR -> internalError();
        };
    }

    @GetMapping("/api/support/tickets/{token}")
    public ResponseEntity<?> getTicket(@PathVariable String token) {
        return supportTicketUseCase
                .getTicketByToken(token)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> status(HttpStatus.NOT_FOUND, "ticket_not_found"));
    }

    @PostMapping("/api/support/tickets/{token}/reply")
    public ResponseEntity<?> reply(@PathVariable String token, @RequestBody MessageRequest request) {
        SupportTicketUseCase.ReplyOutcome outcome = supportTicketUseCase.replyAsUser(token, request.message(), publicHost);
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case TICKET_NOT_FOUND -> status(HttpStatus.NOT_FOUND, "ticket_not_found");
            case TICKET_CLOSED -> status(HttpStatus.CONFLICT, "ticket_closed");
            case INVALID_MESSAGE -> badRequest("invalid_message");
            case CODE_ON_COOLDOWN -> status(HttpStatus.TOO_MANY_REQUESTS, "code_on_cooldown");
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
