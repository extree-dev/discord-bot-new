package tech.extree.stats.adapter.in.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.application.port.in.RiotLookupUseCase;

/**
 * Соответствует POST /api/riot/lookup в server.js (Node). Тело запроса
 * {@code {"riotId":"Имя#Тег"}} — свободный ввод, парсинг внутри use case
 * (Validation.parseRiotId). HTTP-статусы и snake_case error-коды повторены
 * один в один.
 */
@RestController
public class RiotLookupController {

    private final RiotLookupUseCase riotLookupUseCase;

    public RiotLookupController(RiotLookupUseCase riotLookupUseCase) {
        this.riotLookupUseCase = riotLookupUseCase;
    }

    @PostMapping("/api/riot/lookup")
    public ResponseEntity<?> lookup(@RequestBody(required = false) LookupRequest request) {
        String rawRiotId = request == null ? null : request.riotId();
        RiotLookupUseCase.LookupResult result = riotLookupUseCase.lookup(rawRiotId);
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(new LookupResponse(true, result.gameName(), result.tagLine()));
            case INVALID_RIOT_ID -> status(HttpStatus.BAD_REQUEST, "invalid_riot_id");
            case NOT_CONFIGURED -> status(HttpStatus.SERVICE_UNAVAILABLE, "riot_api_not_configured");
            case NOT_FOUND -> status(HttpStatus.NOT_FOUND, "riot_account_not_found");
            case API_ERROR -> status(HttpStatus.BAD_GATEWAY, "riot_api_error");
        };
    }

    private static ResponseEntity<ErrorResponse> status(HttpStatus status, String error) {
        return ResponseEntity.status(status).body(new ErrorResponse(error));
    }

    public record LookupRequest(String riotId) {}

    public record LookupResponse(boolean ok, String gameName, String tagLine) {}
}