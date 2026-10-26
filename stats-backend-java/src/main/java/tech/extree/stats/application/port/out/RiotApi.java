package tech.extree.stats.application.port.out;

import java.util.Optional;

public interface RiotApi {
    boolean isConfigured();
    Optional<RiotAccount> lookupAccount(String gameName, String tagLine);
    record RiotAccount(String gameName, String tagLine) {}
}