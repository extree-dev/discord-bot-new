package tech.extree.stats.application.port.out;

/** Соответствует loginLocations.js (Node) — таблица stats_known_locations. */
public interface LoginLocationRepository {
    boolean hasAnyKnownLocation(String userId);

    /** country == null всегда возвращает true (см. loginLocations.js — "нет данных" не блокирует). */
    boolean isKnownLocation(String userId, String country);

    /** No-op при country == null, как и Node. */
    void rememberLocation(String userId, String country, String city, String ip);
}
