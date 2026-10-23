package tech.extree.stats.adapter.in.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * CSRF-фильтр: для mutating-методов на /api/** и /auth/** проверяет
 * X-CSRF-Token == cookie `csrf`. Иначе 403 csrf_failed.
 *
 * Исключения (публичные эндпоинты, где cookie ещё нет):
 *   /auth/login, /auth/register, /auth/verify, /auth/resend-code,
 *   /auth/forgot-password, /auth/reset-password,
 *   /auth/login/resend-code, /auth/login/confirm-location,
 *   /auth/login/verify-2fa,
 *   /api/csrf-token, /api/account/me (GET), /api/riot/lookup (публичный),
 *   /api/support/tickets (публичный — можно создать тикет без логина).
 *
 * Для GET/HEAD/OPTIONS — пропускаем.
 */
@Component
@Order(2)  // после AuthRateLimitFilter (@Order без явного = LOWEST_PRECEDENCE, но @Component — порядок недетерминирован; явный @Order важен)
public class CsrfFilter extends OncePerRequestFilter {

    private static final Set<String> EXEMPT_PATHS = Set.of(
            "/auth/login",
            "/auth/register",
            "/auth/verify",
            "/auth/resend-code",
            "/auth/forgot-password",
            "/auth/reset-password",
            "/auth/login/resend-code",
            "/auth/login/confirm-location",
            "/auth/login/verify-2fa",
            "/api/csrf-token"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String method = req.getMethod();
        if (!"POST".equals(method) && !"PUT".equals(method)
                && !"PATCH".equals(method) && !"DELETE".equals(method)) {
            chain.doFilter(req, res);
            return;
        }

        String path = req.getRequestURI();
        // Только /api/** и /auth/** (всё остальное — статика, Caddy её не проксирует)
        if (!path.startsWith("/api/") && !path.startsWith("/auth/")) {
            chain.doFilter(req, res);
            return;
        }
        if (EXEMPT_PATHS.contains(path)) {
            chain.doFilter(req, res);
            return;
        }

        // Публичный POST /api/support/tickets (можно подать без логина)
        if ("/api/support/tickets".equals(path)) {
            chain.doFilter(req, res);
            return;
        }

        String header = req.getHeader("X-CSRF-Token");
        String cookieToken = null;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("csrf".equals(c.getName())) {
                    cookieToken = c.getValue();
                    break;
                }
            }
        }

        if (header == null || cookieToken == null || !header.equals(cookieToken)) {
            res.setStatus(403);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"csrf_failed\"}");
            return;
        }

        chain.doFilter(req, res);
    }
}