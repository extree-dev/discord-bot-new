package tech.extree.stats.application.port.out;

import tech.extree.stats.domain.Location;

/**
 * Соответствует geo.js (Node): офлайн геолокация по IP, ни один внешний
 * сервис не вызывается, см. IpCountryGeoLookup. lookup() никогда не
 * бросает и не возвращает null — Location.UNKNOWN на любую проблему
 * (приватный IP, пробел в базе, невалидный адрес), как и Node.
 */
public interface GeoLookup {
    Location lookup(String ip);
}
