package tech.extree.stats.application.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.port.in.RiotAuthUseCase;
import tech.extree.stats.application.port.out.RiotOAuth;
import tech.extree.stats.application.port.out.SessionRepository;

/**
 * Соответствует /auth/riot/login и /auth/riot/callback в server.js (Node),
 * включая "не настроено → редирект с ошибкой, а не поход в Riot с пустым
 * client_id" и генерацию state (16 случайных байт в hex). Сессия —
 * та же extree_stats_session, что и у email+пароль-входа; в сессии
 * сохраняется sub (Riot identity), а не userId, — как и Node. RSO-вход не
 * привязан ни к одному аккаунту stats_users, поэтому в "Recent Sign-ins"
 * не попадает (см. LoginEventController) — отзывать там нечего, revoke
 * доступен только через logout текущего устройства.
 */
@Service
public class RiotAuthService implements RiotAuthUseCase {

    private static final Logger log = LoggerFactory.getLogger(RiotAuthService.class);

    private final RiotOAuth riotOAuth;
    private final SessionRepository sessionRepository;
    private final String clientId;
    private final String clientSecret;

    public RiotAuthService(
            RiotOAuth riotOAuth,
            SessionRepository sessionRepository,
            @Value("${extree.riot.client-id:}") String clientId,
            @Value("${extree.riot.client-secret:}") String clientSecret) {
        this.riotOAuth = riotOAuth;
        this.sessionRepository = sessionRepository;
        this.clientId = clientId == null ? "" : clientId.trim();
        this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
    }

    @Override
    public String buildLoginRedirect(String requestHost, String state) {
        if (clientId.isEmpty()) {
            return null;
        }
        return riotOAuth.buildAuthorizeUrl(clientId, redirectUriFor(requestHost), state);
    }

    @Override
    public CallbackResult handleCallback(
            String requestHost, String code, String state, String expectedState, String clientIp, String userAgent) {
        // Те же проверки, что в Node: Riot не настроен / нет code / нет state /
        // state не совпадает с cookie — не поход в Riot, а честный редирект с
        // ошибкой. Порядок важен: если clientId/secret пусты, мы даже не должны
        // пытаться обменять код (в Node проверка в начале, до exchangeCode).
        if (clientId.isEmpty() || clientSecret.isEmpty()) {
            return CallbackResult.error();
        }
        if (code == null || code.isBlank() || state == null || expectedState == null
                || !constantTimeEquals(state, expectedState)) {
            return CallbackResult.error();
        }

        try {
            RiotOAuth.RiotTokens tokens =
                    riotOAuth.exchangeCode(clientId, clientSecret, redirectUriFor(requestHost), code);
            RiotOAuth.RiotIdentity identity = riotOAuth.fetchIdentity(tokens.accessToken());
            SessionRepository.Created session =
                    sessionRepository.create(identity.sub(), null, clientIp, userAgent, true);
            return new CallbackResult(true, session.token());
        } catch (RuntimeException e) {
            // Как и в Node: сетевые/протокольные ошибки Riot не роняют процесс,
            // а логируются — пользователь получает /?auth_error=1.
            log.warn("stats-backend-java: ошибка обмена кода на токен Riot", e);
            return CallbackResult.error();
        }
    }

    /** Тот же redirect_uri, что в Node (redirectUriFor в server.js). */
    private static String redirectUriFor(String requestHost) {
        return "https://" + requestHost + "/auth/riot/callback";
    }

    /** 16 случайных байт в hex — как crypto.randomBytes(16).toString('hex'). */
    public static String newState() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    // MessageDigest.isEqual — сравнение за время, не зависящее от того, на
    // каком байте токены расходятся (та же логика, что CsrfFilter/TotpService).
    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}