package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Зеркалит req.ip под app.set('trust proxy', 1) в server.js (Node) —
 * ровно один доверенный хоп (Caddy) перед сервисом, поэтому берём САМОЕ
 * ПЕРВОЕ значение X-Forwarded-For (ближайший к клиенту адрес), не
 * последнее и не remoteAddr Caddy.
 */
final class ClientIp {

    private ClientIp() {}

    static String from(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
