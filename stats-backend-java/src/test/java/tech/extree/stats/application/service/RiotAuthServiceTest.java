package tech.extree.stats.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tech.extree.stats.application.port.in.RiotAuthUseCase;
import tech.extree.stats.application.port.out.RiotOAuth;
import tech.extree.stats.application.port.out.SessionRepository;

@ExtendWith(MockitoExtension.class)
class RiotAuthServiceTest {

    private static final String HOST = "stats.extree.tech";
    private static final String CLIENT_ID = "test-client";
    private static final String CLIENT_SECRET = "test-secret";
    private static final String REDIRECT_URI = "https://stats.extree.tech/auth/riot/callback";

    @Mock private RiotOAuth riotOAuth;
    @Mock private SessionRepository sessionRepository;

    private RiotAuthService service;

    @BeforeEach
    void setUp() {
        service = new RiotAuthService(riotOAuth, sessionRepository, CLIENT_ID, CLIENT_SECRET);
    }

    @Test
    void buildLoginRedirectReturnsNullWhenClientIdIsEmpty() {
        RiotAuthService withoutClient = new RiotAuthService(riotOAuth, sessionRepository, "", CLIENT_SECRET);
        assertThat(withoutClient.buildLoginRedirect(HOST, "state123")).isNull();
        verify(riotOAuth, never()).buildAuthorizeUrl(any(), any(), any());
    }

    @Test
    void buildLoginRedirectDelegatesToAdapterWithRedirectUriFromHost() {
        when(riotOAuth.buildAuthorizeUrl(CLIENT_ID, REDIRECT_URI, "state123")).thenReturn("https://auth.riotgames.com/authorize?...");
        String url = service.buildLoginRedirect(HOST, "state123");
        assertThat(url).startsWith("https://auth.riotgames.com/authorize");
        verify(riotOAuth).buildAuthorizeUrl(CLIENT_ID, REDIRECT_URI, "state123");
    }

    @Test
    void callbackRejectsWhenClientIdOrSecretEmpty() {
        RiotAuthService withoutSecret = new RiotAuthService(riotOAuth, sessionRepository, CLIENT_ID, "");
        RiotAuthUseCase.CallbackResult result = withoutSecret.handleCallback(HOST, "code", "state", "state", "ip", "ua");
        assertThat(result.ok()).isFalse();
        verify(riotOAuth, never()).exchangeCode(any(), any(), any(), any());
    }

    @Test
    void callbackRejectsWhenStateMismatches() {
        RiotAuthUseCase.CallbackResult result = service.handleCallback(HOST, "code", "attacker", "expected", "ip", "ua");
        assertThat(result.ok()).isFalse();
        verify(riotOAuth, never()).exchangeCode(any(), any(), any(), any());
    }

    @Test
    void callbackRejectsWhenCodeIsMissing() {
        RiotAuthUseCase.CallbackResult result = service.handleCallback(HOST, null, "state", "state", "ip", "ua");
        assertThat(result.ok()).isFalse();
        verify(riotOAuth, never()).exchangeCode(any(), any(), any(), any());
    }

    @Test
    void callbackExchangesCodeAndBuildsSessionCookie() {
        when(riotOAuth.exchangeCode(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, "the-code"))
                .thenReturn(new RiotOAuth.RiotTokens("access-token"));
        when(riotOAuth.fetchIdentity("access-token")).thenReturn(new RiotOAuth.RiotIdentity("riot-sub-1"));
        when(sessionRepository.create(any(), any(), any(), any(), anyBoolean()))
                .thenReturn(new SessionRepository.Created("encrypted-cookie", "session-id"));

        RiotAuthUseCase.CallbackResult result = service.handleCallback(HOST, "the-code", "state", "state", "ip", "ua");

        assertThat(result.ok()).isTrue();
        assertThat(result.sessionCookie()).isEqualTo("encrypted-cookie");
        verify(sessionRepository).create(any(), any(), any(), any(), anyBoolean());
    }

    @Test
    void callbackSurvivesAdapterException() {
        when(riotOAuth.exchangeCode(any(), any(), any(), any())).thenThrow(new RuntimeException("network down"));

        RiotAuthUseCase.CallbackResult result = service.handleCallback(HOST, "code", "state", "state", "ip", "ua");
        assertThat(result.ok()).isFalse();
        verify(sessionRepository, never()).create(any(), any(), any(), any(), anyBoolean());
    }

    @Test
    void callbackSurvivesIdentityException() {
        when(riotOAuth.exchangeCode(any(), any(), any(), any())).thenReturn(new RiotOAuth.RiotTokens("tok"));
        when(riotOAuth.fetchIdentity("tok")).thenThrow(new RuntimeException("userinfo down"));

        RiotAuthUseCase.CallbackResult result = service.handleCallback(HOST, "code", "state", "state", "ip", "ua");
        assertThat(result.ok()).isFalse();
    }

    @Test
    void newStateIsHexOf16Bytes() {
        String state = RiotAuthService.newState();
        assertThat(state).hasSize(32).matches("[0-9a-f]{32}");
        // Два вызова подряд не должны совпадать (SecureRandom).
        assertThat(RiotAuthService.newState()).isNotEqualTo(state);
    }
}