package tech.extree.stats.adapter.out.riot;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.RiotOAuth;

@Component
public class RiotOAuthAdapter implements RiotOAuth {

    private static final String RIOT_AUTH_HOST = "https://auth.riotgames.com";
    private static final Duration TIMEOUT = Duration.ofSeconds(15);

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

    @Override
    public String buildAuthorizeUrl(String clientId, String redirectUri, String state) {
        String params =
                "client_id=" + enc(clientId)
                        + "&redirect_uri=" + enc(redirectUri)
                        + "&response_type=code"
                        + "&scope=" + enc("openid offline_access")
                        + "&state=" + enc(state);
        return RIOT_AUTH_HOST + "/authorize?" + params;
    }

    @Override
    public RiotTokens exchangeCode(String clientId, String clientSecret, String redirectUri, String code) {
        String body =
                "client_id=" + enc(clientId)
                        + "&client_secret=" + enc(clientSecret)
                        + "&grant_type=authorization_code"
                        + "&code=" + enc(code)
                        + "&redirect_uri=" + enc(redirectUri);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(RIOT_AUTH_HOST + "/token"))
                .timeout(TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = send(request, "Riot token exchange");
        String accessToken = extractString(response.body(), "access_token");
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalStateException("Riot token exchange: ответ без access_token");
        }
        return new RiotTokens(accessToken);
    }

    @Override
    public RiotIdentity fetchIdentity(String accessToken) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(RIOT_AUTH_HOST + "/userinfo"))
                .timeout(TIMEOUT)
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();
        HttpResponse<String> response = send(request, "Riot userinfo");
        String sub = extractString(response.body(), "sub");
        if (sub == null || sub.isBlank()) {
            throw new IllegalStateException("Riot userinfo: ответ без sub");
        }
        return new RiotIdentity(sub);
    }

    private HttpResponse<String> send(HttpRequest request, String label) {
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException(label + " failed: " + response.statusCode());
            }
            return response;
        } catch (java.io.IOException e) {
            throw new IllegalStateException(label + " failed: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(label + " interrupted", e);
        }
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