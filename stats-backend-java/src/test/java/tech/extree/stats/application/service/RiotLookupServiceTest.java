package tech.extree.stats.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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
import tech.extree.stats.application.port.in.RiotLookupUseCase.LookupOutcome;
import tech.extree.stats.application.port.in.RiotLookupUseCase.LookupResult;
import tech.extree.stats.application.port.out.RiotApi;

@ExtendWith(MockitoExtension.class)
class RiotLookupServiceTest {

    @Mock private RiotApi riotApi;

    private RiotLookupService service;

    @BeforeEach
    void setUp() {
        service = new RiotLookupService(riotApi);
    }

    @Test
    void rejectsNullInput() {
        assertThat(service.lookup(null).outcome()).isEqualTo(LookupOutcome.INVALID_RIOT_ID);
        verify(riotApi, never()).lookupAccount(any(), any());
    }

    @Test
    void rejectsEmptyInput() {
        assertThat(service.lookup("   ").outcome()).isEqualTo(LookupOutcome.INVALID_RIOT_ID);
    }

    @Test
    void rejectsInputWithoutHash() {
        assertThat(service.lookup("TestUser").outcome()).isEqualTo(LookupOutcome.INVALID_RIOT_ID);
    }

    @Test
    void rejectsTooShortTagLine() {
        assertThat(service.lookup("Test#EU").outcome()).isEqualTo(LookupOutcome.INVALID_RIOT_ID);
    }

    @Test
    void rejectsTooLongGameName() {
        String longName = "a".repeat(17);
        assertThat(service.lookup(longName + "#EUW").outcome()).isEqualTo(LookupOutcome.INVALID_RIOT_ID);
    }

    @Test
    void returnsNotConfiguredWhenApiKeyMissing() {
        when(riotApi.isConfigured()).thenReturn(false);
        LookupResult result = service.lookup("Test#EUW");
        assertThat(result.outcome()).isEqualTo(LookupOutcome.NOT_CONFIGURED);
        verify(riotApi, never()).lookupAccount(any(), any());
    }

    @Test
    void returnsNotFoundWhenRiotAnswers404() {
        when(riotApi.isConfigured()).thenReturn(true);
        when(riotApi.lookupAccount("Test", "EUW")).thenReturn(Optional.empty());
        LookupResult result = service.lookup("Test#EUW");
        assertThat(result.outcome()).isEqualTo(LookupOutcome.NOT_FOUND);
    }

    @Test
    void returnsOkOnSuccess() {
        when(riotApi.isConfigured()).thenReturn(true);
        when(riotApi.lookupAccount("Test", "EUW")).thenReturn(Optional.of(new RiotApi.RiotAccount("Test", "EUW")));
        LookupResult result = service.lookup("Test#EUW");
        assertThat(result.outcome()).isEqualTo(LookupOutcome.OK);
        assertThat(result.gameName()).isEqualTo("Test");
        assertThat(result.tagLine()).isEqualTo("EUW");
    }

    @Test
    void returnsApiErrorOnAdapterException() {
        when(riotApi.isConfigured()).thenReturn(true);
        when(riotApi.lookupAccount("Test", "EUW")).thenThrow(new RuntimeException("network down"));
        LookupResult result = service.lookup("Test#EUW");
        assertThat(result.outcome()).isEqualTo(LookupOutcome.API_ERROR);
    }

    @Test
    void trimsInputAroundHash() {
        when(riotApi.isConfigured()).thenReturn(true);
        when(riotApi.lookupAccount("Test", "EUW")).thenReturn(Optional.of(new RiotApi.RiotAccount("Test", "EUW")));
        LookupResult result = service.lookup("  Test#EUW  ");
        assertThat(result.outcome()).isEqualTo(LookupOutcome.OK);
    }
}