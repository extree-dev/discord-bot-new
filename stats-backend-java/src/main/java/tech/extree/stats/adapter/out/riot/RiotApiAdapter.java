package tech.extree.stats.adapter.out.riot;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.RiotApi;

@Component
public class RiotApiAdapter implements RiotApi {

    private static final String ACCOUNT_HOST = "https://americas.api.riotgames.com";
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final String apiKey;

    public RiotApiAdapter(@Value("${extree.riot.api-key:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    @Override
    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    @Override
    public Optional<RiotAccount> lookupAccount(String gameName, String tagLine) {
        if (!isConfigured()) {
            return Optional.empty();
        }
        String url = ACCOUNT_HOST
                + "/riot/account/v1/accounts/by-riot-id/"
                + enc(gameName)
                + "/"
                + enc(tagLine);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(TIMEOUT)
                .header("X-Riot-Token", apiKey)
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Riot account lookup failed: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Riot account lookup interrupted", e);
        }

        if (response.statusCode() == 404) {
            return Optional.empty();
        }
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException("Riot account lookup failed: " + response.statusCode());
        }

        String body = response.body();
        String resolvedGameName = extractString(body, "gameName");
        String resolvedTagLine = extractString(body, "tagLine");
        if (resolvedGameName == null || resolvedTagLine == null) {
            throw new IllegalStateException("Riot account lookup: ответ без gameName/tagLine");
        }
        return Optional.of(new RiotAccount(resolvedGameName, resolvedTagLine));
    }

    private static String extractString(String json, String key) {
        if (json == null) return null;
        String needle = "\"" + key + "\":\"";
        int start = json.indexOf(needle);
        if (start < 0) {
            needle = "\"" + key + "\": \"";
            start = json.indexOf(needle);
            if (start < 0) return null;
        }
        int valueStart = start + needle.length();
        int valueEnd = json.indexOf('"', valueStart);
        if (valueEnd < 0) return null;
        return json.substring(valueStart, valueEnd);
    }

    private static String enc(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}