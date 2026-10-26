package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.domain.Location;

/**
 * Caddy's forward_auth hits GET /internal/geo-check on EVERY request to
 * stats.extree.tech — static SPA files included, not just /api|/auth —
 * BEFORE routing anywhere else (see web/Caddyfile). A 2xx response lets
 * Caddy continue; any other status is relayed to the visitor byte-for-byte
 * (status + body), which is how the HTML below actually reaches the
 * browser instead of just a bare 403.
 *
 * <p>Reuses the same offline country-level GeoIP data (IpCountryGeoLookup)
 * already used for the "sign-in from a new country" check, and the same
 * ClientIp.from() logic (trusts the last X-Forwarded-For hop — Caddy is
 * the only proxy in front of this service either way, so the trust
 * assumption that fix relies on holds here too).
 *
 * <p>Geo-blocking the whole domain, unconditionally, before any auth
 * check, has one sharp edge: it blocks the SITE OWNER too if they ever
 * connect from a blocked country — there's no "logged in as admin" bypass
 * possible, since the block happens before login is even reachable. The
 * {@code extree_geo_bypass} cookie exists for exactly that: set
 * {@code GEO_BYPASS_TOKEN} in the server's .env to some random secret,
 * then once, from a browser that isn't blocked, run in devtools:
 * {@code document.cookie = "extree_geo_bypass=<token>; domain=.extree.tech; path=/; max-age=31536000"}
 * — that browser/device bypasses the geo-check from then on, regardless
 * of IP. Leave GEO_BYPASS_TOKEN unset to disable the bypass entirely.
 */
@RestController
public class GeoBlockController {

    // Единственное место, где перечислены заблокированные страны —
    // меняется здесь, без правок Caddyfile/фронта.
    private static final Set<String> BLOCKED_COUNTRIES = Set.of("RU");
    private static final String BYPASS_COOKIE = "extree_geo_bypass";

    private final GeoLookup geoLookup;
    private final String blockedPageHtml;
    private final String bypassToken;

    public GeoBlockController(GeoLookup geoLookup, @Value("${extree.geo-bypass-token:}") String bypassToken) {
        this.geoLookup = geoLookup;
        this.blockedPageHtml = readResource("static-pages/geo-blocked.html");
        this.bypassToken = bypassToken == null ? "" : bypassToken.trim();
    }

    @GetMapping("/internal/geo-check")
    public ResponseEntity<String> check(HttpServletRequest request) {
        if (hasValidBypassCookie(request)) {
            return ResponseEntity.ok().build();
        }

        String ip = ClientIp.from(request);
        Location location = geoLookup.lookup(ip);
        if (location.country() != null && BLOCKED_COUNTRIES.contains(location.country())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .contentType(MediaType.TEXT_HTML)
                    .body(blockedPageHtml);
        }
        return ResponseEntity.ok().build();
    }

    private boolean hasValidBypassCookie(HttpServletRequest request) {
        if (bypassToken.isEmpty() || request.getCookies() == null) {
            return false;
        }
        for (Cookie cookie : request.getCookies()) {
            if (BYPASS_COOKIE.equals(cookie.getName()) && constantTimeEquals(cookie.getValue(), bypassToken)) {
                return true;
            }
        }
        return false;
    }

    // MessageDigest.isEqual — та же защита от timing-атаки, что и для
    // CSRF/recovery-кодов/OAuth state в остальном проекте.
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private static String readResource(String path) {
        try {
            return new String(new ClassPathResource(path).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось прочитать " + path, e);
        }
    }
}
