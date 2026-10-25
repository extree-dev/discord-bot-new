package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Зеркалит req.ip под app.set('trust proxy', 1) в server.js (Node) —
 * ровно один доверенный хоп (Caddy) перед сервисом. С trust proxy: 1
 * Express берёт ПОСЛЕДНЕЕ значение X-Forwarded-For — это тот адрес,
 * который дописал сам Caddy (единственный доверенный хоп), а не то, что
 * прислал клиент. Всё, что стоит раньше последнего элемента, может быть
 * подделано самим клиентом через свой же заголовок X-Forwarded-For — его
 * нельзя было брать (предыдущая версия брала первое значение, что
 * позволяло обойти гео-проверку "вход из новой страны" и rate-limit
 * простой подменой заголовка).
 */
final class ClientIp {

    private ClientIp() {}

    static String from(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] parts = xff.split(",");
            return parts[parts.length - 1].trim();
        }
        return request.getRemoteAddr();
    }
}
