package tech.extree.stats.adapter.in.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import tech.extree.stats.application.port.out.GeoLookup;
import tech.extree.stats.domain.Location;

class GeoBlockControllerTest {

    @Test
    void allowsNonBlockedCountry() {
        GeoLookup geoLookup = mock(GeoLookup.class);
        when(geoLookup.lookup("203.0.113.9")).thenReturn(new Location("US", null));
        GeoBlockController controller = new GeoBlockController(geoLookup, "");

        HttpServletRequest request = requestFromIp("203.0.113.9");
        ResponseEntity<String> response = controller.check(request);

        assertEquals(200, response.getStatusCode().value());
    }

    @Test
    void blocksConfiguredCountryWithHtmlPage() {
        GeoLookup geoLookup = mock(GeoLookup.class);
        when(geoLookup.lookup("203.0.113.9")).thenReturn(new Location("RU", null));
        GeoBlockController controller = new GeoBlockController(geoLookup, "");

        HttpServletRequest request = requestFromIp("203.0.113.9");
        ResponseEntity<String> response = controller.check(request);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(MediaType.TEXT_HTML, response.getHeaders().getContentType());
        assertTrue(response.getBody().contains("isn&apos;t available in your region"));
    }

    @Test
    void allowsUnknownLocationThrough() {
        GeoLookup geoLookup = mock(GeoLookup.class);
        when(geoLookup.lookup("10.0.0.5")).thenReturn(Location.UNKNOWN);
        GeoBlockController controller = new GeoBlockController(geoLookup, "");

        HttpServletRequest request = requestFromIp("10.0.0.5");
        ResponseEntity<String> response = controller.check(request);

        assertEquals(200, response.getStatusCode().value());
    }

    @Test
    void bypassCookieSkipsTheCheckEvenForABlockedCountry() {
        GeoLookup geoLookup = mock(GeoLookup.class);
        when(geoLookup.lookup("203.0.113.9")).thenReturn(new Location("RU", null));
        GeoBlockController controller = new GeoBlockController(geoLookup, "s3cr3t");

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9");
        when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("extree_geo_bypass", "s3cr3t")});

        ResponseEntity<String> response = controller.check(request);

        assertEquals(200, response.getStatusCode().value());
    }

    @Test
    void wrongBypassCookieDoesNotSkipTheCheck() {
        GeoLookup geoLookup = mock(GeoLookup.class);
        when(geoLookup.lookup("203.0.113.9")).thenReturn(new Location("RU", null));
        GeoBlockController controller = new GeoBlockController(geoLookup, "s3cr3t");

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9");
        when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("extree_geo_bypass", "wrong")});

        ResponseEntity<String> response = controller.check(request);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    private static HttpServletRequest requestFromIp(String ip) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For")).thenReturn(ip);
        return request;
    }
}
