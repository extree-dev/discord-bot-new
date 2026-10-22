package tech.extree.stats.application.port.in;

/**
 * Соответствует POST /api/riot/lookup в server.js (Node). Дискриминированный
 * результат — чтобы контроллер мог отдать разные HTTP-статусы и коды
 * ошибок, как и Node:
 *   - OK                     → 200 {ok:true, gameName, tagLine}
 *   - INVALID_RIOT_ID        → 400 {error:"invalid_riot_id"}
 *   - NOT_CONFIGURED         → 503 {error:"riot_api_not_configured"}
 *   - NOT_FOUND              → 404 {error:"riot_account_not_found"}
 *   - API_ERROR              → 502 {error:"riot_api_error"}
 */
public interface RiotLookupUseCase {

    enum LookupOutcome {
        OK,
        INVALID_RIOT_ID,
        NOT_CONFIGURED,
        NOT_FOUND,
        API_ERROR
    }

    record LookupResult(LookupOutcome outcome, String gameName, String tagLine) {
        public static LookupResult error(LookupOutcome outcome) {
            return new LookupResult(outcome, null, null);
        }
    }

    /** rawRiotId — свободный ввод "Имя#Тег"; парсинг — Validation.parseRiotId. */
    LookupResult lookup(String rawRiotId);
}