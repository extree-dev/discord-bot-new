package tech.extree.stats.adapter.in.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Зеркалит riotLookupRateLimiter в server.js (Node): express-rate-limit,
 * windowMs 2 минуты, limit 80, применённый к /api/riot/lookup, per-IP,
 * фиксированное окно. Отдельный от AuthRateLimitFilter (у того 300/5мин
 * на /auth и /api в целом) — как и в Node, где это два разных лимитера.
 *
 * Комментарий в Node про "лимит должен защищать общий ключ Riot" —
 * неточность: express-rate-limit по умолчанию берёт ключом req.ip, то
 * есть лимит per-IP. Здесь сохраняем поведение кода, не комментария.
 */
@Component
public class RiotRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 2 * 60 * 1000L;
    private static final int LIMIT = 80;

    private static final class Counter {
        long windowStart = System.currentTimeMillis();
        int count;
    }

    private final ConcurrentHashMap<String, Counter> counters = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!"/api/riot/lookup".equals(path)) {
            chain.doFilter(request, response);
            return;
        }

        String ip = ClientIp.from(request);
        if (!tryConsume(ip)) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"rate_limited\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private boolean tryConsume(String key) {
        Counter counter = counters.computeIfAbsent(key, k -> new Counter());
        synchronized (counter) {
            long now = System.currentTimeMillis();
            if (now - counter.windowStart >= WINDOW_MILLIS) {
                counter.windowStart = now;
                counter.count = 0;
            }
            counter.count++;
            return counter.count <= LIMIT;
        }
    }
}