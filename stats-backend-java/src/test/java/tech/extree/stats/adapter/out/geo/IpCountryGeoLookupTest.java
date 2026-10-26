package tech.extree.stats.adapter.out.geo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tech.extree.stats.domain.Location;

/**
 * Решающий тест: ожидаемые страны ниже получены РЕАЛЬНОЙ библиотекой
 * geoip-lite (Node), принудительно направленной на ТЕ ЖЕ бинарные файлы
 * geoip-country(6).dat, что скопированы в resources/geoip/ (через
 * GEODATADIR=<каталог только с country-файлами> node -e "geoip.lookup(ip)"
 * — тот же приём ENOENT-фолбэка на country-only данные, что preload() в
 * lib/geoip.js делает сам, когда city-файлов нет). Если этот тест падает —
 * порт бинарного поиска разошёлся с оригиналом.
 *
 * <p>ВАЖНО: Node-сервис (geo.js) по умолчанию использует CITY-уровень
 * данных (geoip-city(6).dat, ~135MB, отдельно не перенесён — см. Javadoc
 * IpCountryGeoLookup), поэтому country, который вернёт ЭТОТ сервис, может
 * в редких краевых случаях (нестандартные/anycast-диапазоны) отличаться от
 * того, что вернул бы живой Node на том же IP. Для county-only данных —
 * которые тут и используются — результат идентичен побитово.
 */
class IpCountryGeoLookupTest {

    private final IpCountryGeoLookup lookup = new IpCountryGeoLookup();

    @ParameterizedTest
    @CsvSource({
        "8.8.8.8, US",
        "77.88.55.55, RU",
        "95.108.213.12, RU",
        "185.199.108.153, US",
        "1.0.0.0, AU", // первая запись country.dat
        "1.0.0.255, AU", // верхняя граница первой записи
        "223.255.255.0, AU", // последняя запись country.dat
        "223.255.255.255, AU", // верхняя граница последней записи
    })
    void resolvesKnownIpv4AddressesExactlyLikeNode(String ip, String expectedCountry) {
        assertThat(lookup.lookup(ip)).isEqualTo(new Location(expectedCountry, null));
    }

    @ParameterizedTest
    @CsvSource({
        "1.1.1.1", // нет записи в country-only данных (есть только в city)
        "203.0.113.5", // TEST-NET-3, не размечен
        "0.255.255.255", // ниже первой записи
        "224.0.0.0", // выше последней записи (multicast)
    })
    void returnsUnknownForIpv4AddressesWithNoRange(String ip) {
        assertThat(lookup.lookup(ip)).isEqualTo(Location.UNKNOWN);
    }

    @ParameterizedTest
    @CsvSource({"10.0.0.5", "172.20.5.5", "192.168.1.1"})
    void returnsUnknownForPrivateIpv4Ranges(String ip) {
        assertThat(lookup.lookup(ip)).isEqualTo(Location.UNKNOWN);
    }

    @ParameterizedTest
    @CsvSource({
        "2001:4860:4860::8888, US", // v4-mapped-эквивалент 8.8.8.8 через Google Public DNS64 диапазон
        "2606:4700:4700::1111, US",
        "280:14c:418:1000::, BR", // первая запись country6.dat
        "280:14c:418:1000:ffff:ffff:ffff:ffff, BR",
        "2c0f:fff0::, NG", // последняя запись country6.dat
        "2c0f:fff0:ffff:ffff:ffff:ffff:ffff:ffff, NG",
    })
    void resolvesKnownIpv6AddressesExactlyLikeNode(String ip, String expectedCountry) {
        assertThat(lookup.lookup(ip)).isEqualTo(new Location(expectedCountry, null));
    }

    @ParameterizedTest
    @CsvSource({"::1", "fe80::1"})
    void returnsUnknownForIpv6AddressesWithNoRange(String ip) {
        assertThat(lookup.lookup(ip)).isEqualTo(Location.UNKNOWN);
    }

    @Test
    void returnsUnknownForGarbageInput() {
        assertThat(lookup.lookup("not-an-ip")).isEqualTo(Location.UNKNOWN);
        assertThat(lookup.lookup(null)).isEqualTo(Location.UNKNOWN);
        assertThat(lookup.lookup("")).isEqualTo(Location.UNKNOWN);
    }

    @Test
    void stripsIpv4MappedIpv6Prefix() {
        // "::ffff:x.x.x.x" — geo.js (Node) срезает этот префикс перед
        // geoip.lookup(); здесь та же нормализация.
        assertThat(lookup.lookup("::ffff:8.8.8.8")).isEqualTo(new Location("US", null));
    }
}
