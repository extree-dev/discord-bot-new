package tech.extree.stats.domain;

/**
 * Зеркало { country, city } из ../../stats-backend/geo.js. country null
 * значит "IP не удалось геолоцировать" — везде по кодовой базе это
 * означает "не блокируем", см. loginLocations.js (Node) и
 * LoginService здесь.
 */
public record Location(String country, String city) {
    public static final Location UNKNOWN = new Location(null, null);
}
