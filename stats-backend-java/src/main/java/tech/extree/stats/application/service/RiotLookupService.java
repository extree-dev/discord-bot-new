package tech.extree.stats.application.service;

import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.Validation;
import tech.extree.stats.application.port.in.RiotLookupUseCase;
import tech.extree.stats.application.port.out.RiotApi;

/**
 * Соответствует POST /api/riot/lookup в server.js (Node), правило в
 * правило — включая "не настроено → 503", "404 от Riot → 404 клиенту",
 * "прочие ошибки Riot → 502". Парсинг Riot ID — Validation.parseRiotId
 * (та же функция, что isValidRiotId через parseRiotId в validation.js).
 */
@Service
public class RiotLookupService implements RiotLookupUseCase {

    private static final Logger log = LoggerFactory.getLogger(RiotLookupService.class);

    private final RiotApi riotApi;

    public RiotLookupService(RiotApi riotApi) {
        this.riotApi = riotApi;
    }

    @Override
    public LookupResult lookup(String rawRiotId) {
        Validation.RiotId parsed = Validation.parseRiotId(rawRiotId);
        if (parsed == null) {
            return LookupResult.error(LookupOutcome.INVALID_RIOT_ID);
        }
        if (!riotApi.isConfigured()) {
            return LookupResult.error(LookupOutcome.NOT_CONFIGURED);
        }
        try {
            Optional<RiotApi.RiotAccount> account = riotApi.lookupAccount(parsed.gameName(), parsed.tagLine());
            if (account.isEmpty()) {
                return LookupResult.error(LookupOutcome.NOT_FOUND);
            }
            RiotApi.RiotAccount found = account.get();
            return new LookupResult(LookupOutcome.OK, found.gameName(), found.tagLine());
        } catch (RuntimeException e) {
            // Как и в Node: не пробрасываем 500, а отвечаем 502 riot_api_error.
            log.warn("stats-backend-java: ошибка поиска Riot-аккаунта", e);
            return LookupResult.error(LookupOutcome.API_ERROR);
        }
    }
}