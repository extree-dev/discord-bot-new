package tech.extree.stats.adapter.out.turnstile;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.TurnstileVerifier;

/**
 * Соответствует turnstile.js (Node): POST на siteverify Cloudflare.
 * Fail-closed — пустой секрет или любая ошибка значит false, как и Node
 * (это защита от ботов на /login, тихо пропускать её нельзя).
 */
@Component
public class CloudflareTurnstileVerifier implements TurnstileVerifier {

    private static final Logger log = LoggerFactory.getLogger(CloudflareTurnstileVerifier.class);
    private static final String VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private final String secretKey;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CloudflareTurnstileVerifier(@Value("${extree.turnstile-secret-key:}") String secretKey) {
        this.secretKey = secretKey;
    }

    @Override
    public boolean verify(String token, String remoteIp) {
        if (secretKey == null || secretKey.isBlank()) {
            log.error("stats-backend-java: TURNSTILE_SECRET_KEY не задан — проверка Turnstile невозможна.");
            return false;
        }
        if (token == null || token.isBlank()) {
            return false;
        }

        try {
            java.util.Map<String, String> params = new java.util.LinkedHashMap<>();
            params.put("secret", secretKey);
            params.put("response", token);
            if (remoteIp != null && !remoteIp.isBlank()) {
                params.put("remoteip", remoteIp);
            }
            String form = params.entrySet().stream()
                    .map(e -> urlEncode(e.getKey()) + "=" + urlEncode(e.getValue()))
                    .collect(Collectors.joining("&"));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(VERIFY_URL))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode body = objectMapper.readTree(response.body());
            return body.path("success").asBoolean(false);
        } catch (Exception e) {
            log.error("stats-backend-java: ошибка обращения к Cloudflare Turnstile siteverify", e);
            return false;
        }
    }

    private static String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
