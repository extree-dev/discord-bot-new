package tech.extree.stats.adapter.in.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

class ClientIpTest {

    @Test
    void prefersCfConnectingIpOverForwardedFor() {
        // Фаервол на VPS пускает на 80/443 только Cloudflare — этот
        // заголовок не может прийти ни от кого другого.
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("CF-Connecting-IP")).thenReturn("198.51.100.7");
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9, 10.0.0.5, 192.0.2.1");

        assertEquals("198.51.100.7", ClientIp.from(request));
    }

    @Test
    void usesLastForwardedForEntryAsTheTrustedHop() {
        // Caddy — единственный доверенный хоп — дописывает реальный IP
        // клиента в конец заголовка. Всё, что идёт раньше, клиент мог
        // подделать сам своим собственным X-Forwarded-For.
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9, 10.0.0.5, 198.51.100.7");

        assertEquals("198.51.100.7", ClientIp.from(request));
    }

    @Test
    void fallsBackToRemoteAddrWhenHeaderMissing() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("198.51.100.7");

        assertEquals("198.51.100.7", ClientIp.from(request));
    }

    @Test
    void handlesSingleEntryHeader() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.7");

        assertEquals("198.51.100.7", ClientIp.from(request));
    }
}
