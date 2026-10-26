package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;

/**
 * stats.extree.tech теперь проксируется через Cloudflare (гео-блок RU
 * живёт там, не в этом сервисе — см. web/Caddyfile), а VPS за фаерволом
 * принимает на 80/443 ТОЛЬКО IP-диапазоны Cloudflare — то есть
 * CF-Connecting-IP может прийти только от самого Cloudflare и не может
 * быть подделан клиентом напрямую (прямое соединение с сервером этот
 * заголовок бы вообще не доставило, фаервол дропнет пакет раньше). Это
 * единственный надёжный источник настоящего IP посетителя в таком
 * окружении — Cloudflare выставляет его сам на каждый запрос.
 *
 * <p>Фолбэк на X-Forwarded-For (ровно та же логика, что раньше была
 * основной: trust proxy: 1 под Caddy как единственным доверенным хопом)
 * остаётся на случай, если Cloudflare-проксирование ещё не включено
 * (локальная разработка, или окно между деплоем этого кода и переключением
 * DNS-записи на proxied) — тогда CF-Connecting-IP просто отсутствует.
 */
final class ClientIp {

    private ClientIp() {}

    static String from(HttpServletRequest request) {
        String cfIp = request.getHeader("CF-Connecting-IP");
        if (cfIp != null && !cfIp.isBlank()) {
            return cfIp.trim();
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] parts = xff.split(",");
            return parts[parts.length - 1].trim();
        }
        return request.getRemoteAddr();
    }
}
