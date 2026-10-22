package tech.extree.stats.application.port.out;

public interface RiotOAuth {
    String buildAuthorizeUrl(String clientId, String redirectUri, String state);
    RiotTokens exchangeCode(String clientId, String clientSecret, String redirectUri, String code);
    RiotIdentity fetchIdentity(String accessToken);

    record RiotTokens(String accessToken) {}
    record RiotIdentity(String sub) {}
}