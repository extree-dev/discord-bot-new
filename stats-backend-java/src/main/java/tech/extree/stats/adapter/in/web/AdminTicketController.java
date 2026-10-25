package tech.extree.stats.adapter.in.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.CannedResponsesResponse;
import tech.extree.stats.adapter.in.web.dto.CreateCannedResponseRequest;
import tech.extree.stats.adapter.in.web.dto.CreateCannedResponseResponse;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.MessageRequest;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.adapter.in.web.dto.SetTicketStatusRequest;
import tech.extree.stats.adapter.in.web.dto.TicketDetailResponse;
import tech.extree.stats.adapter.in.web.dto.TicketListResponse;
import tech.extree.stats.application.port.in.AdminTicketUseCase;

/**
 * Соответствует requireAdmin + /api/admin/tickets*, /api/admin/canned-responses*
 * в server.js — вся админка тикет-платформы.
 */
@RestController
public class AdminTicketController {

    private final AdminTicketUseCase adminTicketUseCase;
    private final String publicHost;

    public AdminTicketController(
            AdminTicketUseCase adminTicketUseCase, @Value("${extree.public-host}") String publicHost) {
        this.adminTicketUseCase = adminTicketUseCase;
        this.publicHost = publicHost;
    }

    @GetMapping("/api/admin/tickets")
    public ResponseEntity<?> listTickets(
            @RequestParam(required = false) String status,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AdminTicketUseCase.ListResult result = adminTicketUseCase.listTickets(cookie, status);
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(new TicketListResponse(result.tickets()));
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case FORBIDDEN -> status(HttpStatus.FORBIDDEN, "forbidden");
            case INVALID_REQUEST -> badRequest("invalid_request");
        };
    }

    @GetMapping("/api/admin/tickets/{number}")
    public ResponseEntity<?> getTicket(
            @PathVariable String number, @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AdminTicketUseCase.DetailResult result = adminTicketUseCase.getTicket(cookie, number);
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(new TicketDetailResponse(result.ticket(), result.replies()));
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case FORBIDDEN -> status(HttpStatus.FORBIDDEN, "forbidden");
            case TICKET_NOT_FOUND -> status(HttpStatus.NOT_FOUND, "ticket_not_found");
        };
    }

    @PostMapping("/api/admin/tickets/{number}/reply")
    public ResponseEntity<?> reply(
            @PathVariable String number,
            @RequestBody MessageRequest request,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AdminTicketUseCase.ReplyOutcome outcome = adminTicketUseCase.reply(cookie, number, request.message(), publicHost);
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case FORBIDDEN -> status(HttpStatus.FORBIDDEN, "forbidden");
            case INVALID_MESSAGE -> badRequest("invalid_message");
            case TICKET_NOT_FOUND -> status(HttpStatus.NOT_FOUND, "ticket_not_found");
        };
    }

    @PostMapping("/api/admin/tickets/{number}/status")
    public ResponseEntity<?> setStatus(
            @PathVariable String number,
            @RequestBody SetTicketStatusRequest request,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AdminTicketUseCase.StatusOutcome outcome = adminTicketUseCase.setStatus(cookie, number, request.status());
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case FORBIDDEN -> status(HttpStatus.FORBIDDEN, "forbidden");
            case INVALID_REQUEST -> badRequest("invalid_request");
            case TICKET_NOT_FOUND -> status(HttpStatus.NOT_FOUND, "ticket_not_found");
        };
    }

    @GetMapping("/api/admin/canned-responses")
    public ResponseEntity<?> listCannedResponses(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AdminTicketUseCase.CannedListResult result = adminTicketUseCase.listCannedResponses(cookie);
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(new CannedResponsesResponse(result.responses()));
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case FORBIDDEN -> status(HttpStatus.FORBIDDEN, "forbidden");
        };
    }

    @PostMapping("/api/admin/canned-responses")
    public ResponseEntity<?> createCannedResponse(
            @RequestBody CreateCannedResponseRequest request,
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AdminTicketUseCase.CannedCreateResult result =
                adminTicketUseCase.createCannedResponse(cookie, request.title(), request.body());
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(new CreateCannedResponseResponse(true, result.id()));
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case FORBIDDEN -> status(HttpStatus.FORBIDDEN, "forbidden");
            case INVALID_SUBJECT -> badRequest("invalid_subject");
            case INVALID_MESSAGE -> badRequest("invalid_message");
        };
    }

    @DeleteMapping("/api/admin/canned-responses/{id}")
    public ResponseEntity<?> deleteCannedResponse(
            @PathVariable String id, @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie) {
        AdminTicketUseCase.CannedDeleteOutcome outcome = adminTicketUseCase.deleteCannedResponse(cookie, id);
        return switch (outcome) {
            case OK -> ResponseEntity.ok(OkResponse.OK);
            case UNAUTHORIZED -> status(HttpStatus.UNAUTHORIZED, "unauthorized");
            case FORBIDDEN -> status(HttpStatus.FORBIDDEN, "forbidden");
        };
    }

    private static ResponseEntity<ErrorResponse> badRequest(String error) {
        return status(HttpStatus.BAD_REQUEST, error);
    }

    private static ResponseEntity<ErrorResponse> status(HttpStatus status, String error) {
        return ResponseEntity.status(status).body(new ErrorResponse(error));
    }
}
