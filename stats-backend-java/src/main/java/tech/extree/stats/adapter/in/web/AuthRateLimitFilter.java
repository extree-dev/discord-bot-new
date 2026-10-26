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
 * Зеркалит authRateLimiter в server.js (Node): express-rate-limit,
 * windowMs 5 минут, limit 300, применённый к /auth и /api, per-IP,
 * фиксированное окно (тот же алгоритм, что дефолтный MemoryStore у
 * express-rate-limit). Ответ при превышении — 429 с тем же
 * {"error":"rate_limited"} видом, что и остальные error-коды этого
 * сервиса (у Node — обычный текст, тут не часть документированного
 * контракта ни с одной стороны, расхождение не критично).
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 5 * 60 * 1000L;
    private static final int LIMIT = 300;

    private static final class Counter {
        long windowStart = System.currentTimeMillis();
        int count;
    }

    private final ConcurrentHashMap<String, Counter> counters = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!(path.startsWith("/auth") || path.startsWith("/api"))) {
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
