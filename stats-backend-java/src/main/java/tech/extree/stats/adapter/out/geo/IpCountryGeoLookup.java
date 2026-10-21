package tech.extree.stats.adapter.out.geo;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.domain.Location;

/**
 * Порт geoip-lite (Node) на страновой уровень — читает ТЕ ЖЕ бинарные
 * файлы geoip-country(6).dat, что уже лежат в node_modules/geoip-lite/data/
 * у Node-сервиса (скопированы в resources/geoip/ один в один), и повторяет
 * его алгоритм бинарного поиска (lib/geoip.js: lookup4/lookup6) байт в
 * байт — та же классификация стран для того же IP, что у Node.
 *
 * <p>Сознательно НЕ перенесён city-уровень (geoip-city(6).dat, ~135MB,
 * отдельный формат locationBuffer с именами городов) — city используется
 * только в тексте писем-уведомлений (косметика), а не в проверке
 * "известного места входа" (только country, см. loginLocations.js).
 * city здесь всегда null; formatLocation в письмах уже поддерживает этот
 * путь (страна без города), см. mailer.js — поведение не ломается, просто
 * чуть менее подробный текст письма для входов, обработанных этим сервисом.
 */
@Component
public class IpCountryGeoLookup implements GeoLookup {

    private static final int RECORD_SIZE4 = 10;
    private static final int RECORD_SIZE6 = 34;

    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 — тот же (и только этот)
    // список, что privateRange4 в lib/geoip.js; broader-looking
    // utils.isPrivateIP (127/8, 169.254/16 и т.д.) в самом lookup-пути
    // Node НЕ используется, поэтому и здесь не используется.
    private static final long[][] PRIVATE_RANGES_V4 = {
        {aton4(10, 0, 0, 0), aton4(10, 255, 255, 255)},
        {aton4(172, 16, 0, 0), aton4(172, 31, 255, 255)},
        {aton4(192, 168, 0, 0), aton4(192, 168, 255, 255)},
    };

    private final byte[] v4;
    private final int lastLine4;
    private final long firstIp4;
    private final long lastIp4;

    private final byte[] v6;
    private final int lastLine6;

    public IpCountryGeoLookup() {
        this.v4 = readResource("geoip/geoip-country.dat");
        this.lastLine4 = (v4.length / RECORD_SIZE4) - 1;
        this.firstIp4 = readUInt32BE(v4, 0);
        this.lastIp4 = readUInt32BE(v4, lastLine4 * RECORD_SIZE4 + 4);

        this.v6 = readResource("geoip/geoip-country6.dat");
        this.lastLine6 = (v6.length / RECORD_SIZE6) - 1;
    }

    private static byte[] readResource(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось прочитать geoip-данные: " + path, e);
        }
    }

    @Override
    public Location lookup(String ip) {
        if (ip == null || ip.isBlank()) {
            return Location.UNKNOWN;
        }
        String normalized = ip.startsWith("::ffff:") ? ip.substring(7) : ip;
        try {
            InetAddress addr = InetAddress.getByName(normalized);
            String country =
                    addr instanceof Inet6Address ? lookup6(addr.getAddress()) : lookup4(addr.getAddress());
            return country == null ? Location.UNKNOWN : new Location(country, null);
        } catch (UnknownHostException e) {
            // net.isIP(ip) === 0 в Node для всего, что не является
            // валидным адресом — тот же результат: неизвестно.
            return Location.UNKNOWN;
        }
    }

    private String lookup4(byte[] addr4) {
        long ip = ((addr4[0] & 0xFFL) << 24) | ((addr4[1] & 0xFFL) << 16) | ((addr4[2] & 0xFFL) << 8) | (addr4[3] & 0xFFL);

        if (ip > lastIp4 || ip < firstIp4) {
            return null;
        }
        for (long[] range : PRIVATE_RANGES_V4) {
            if (ip >= range[0] && ip <= range[1]) {
                return null;
            }
        }

        int fline = 0;
        int cline = lastLine4;
        while (true) {
            int line = (int) Math.round((cline - fline) / 2.0) + fline;
            long floor = readUInt32BE(v4, line * RECORD_SIZE4);
            long ceil = readUInt32BE(v4, line * RECORD_SIZE4 + 4);

            if (floor <= ip && ceil >= ip) {
                return new String(v4, line * RECORD_SIZE4 + 8, 2, StandardCharsets.US_ASCII);
            } else if (fline == cline) {
                return null;
            } else if (fline == cline - 1) {
                if (line == fline) {
                    fline = cline;
                } else {
                    cline = fline;
                }
            } else if (floor > ip) {
                cline = line;
            } else if (ceil < ip) {
                fline = line;
            }
        }
    }

    private String lookup6(byte[] addr6) {
        long[] ip = toUint32Groups(addr6);
        long[] first = readIp6(0, 0);
        long[] last = readIp6(lastLine6, 1);

        if (cmp6(ip, last) > 0 || cmp6(ip, first) < 0) {
            return null;
        }

        int fline = 0;
        int cline = lastLine6;
        while (true) {
            int line = (int) Math.round((cline - fline) / 2.0) + fline;
            long[] floor = readIp6(line, 0);
            long[] ceil = readIp6(line, 1);

            if (cmp6(floor, ip) <= 0 && cmp6(ceil, ip) >= 0) {
                int offset = line * RECORD_SIZE6 + 32;
                return new String(v6, offset, 2, StandardCharsets.US_ASCII);
            } else if (fline == cline) {
                return null;
            } else if (fline == cline - 1) {
                if (line == fline) {
                    fline = cline;
                } else {
                    cline = fline;
                }
            } else if (cmp6(floor, ip) > 0) {
                cline = line;
            } else if (cmp6(ceil, ip) < 0) {
                fline = line;
            }
        }
    }

    private long[] readIp6(int line, int offset) {
        long[] out = new long[4];
        int base = line * RECORD_SIZE6 + offset * 16;
        for (int i = 0; i < 4; i++) {
            out[i] = readUInt32BE(v6, base + i * 4);
        }
        return out;
    }

    private static long[] toUint32Groups(byte[] addr16) {
        long[] out = new long[4];
        for (int i = 0; i < 4; i++) {
            out[i] = readUInt32BE(addr16, i * 4);
        }
        return out;
    }

    // Точная копия utils.cmp6 (Node): сравнивает только первые ДВА из
    // четырёх 32-битных слов (старшие 64 бита адреса) — это сознательно
    // сохранённая особенность оригинала, не ошибка порта.
    private static int cmp6(long[] a, long[] b) {
        for (int i = 0; i < 2; i++) {
            if (a[i] < b[i]) {
                return -1;
            }
            if (a[i] > b[i]) {
                return 1;
            }
        }
        return 0;
    }

    private static long readUInt32BE(byte[] buf, int offset) {
        return ((buf[offset] & 0xFFL) << 24)
                | ((buf[offset + 1] & 0xFFL) << 16)
                | ((buf[offset + 2] & 0xFFL) << 8)
                | (buf[offset + 3] & 0xFFL);
    }

    private static long aton4(int a, int b, int c, int d) {
        return ((long) a << 24) | ((long) b << 16) | ((long) c << 8) | d;
    }
}
