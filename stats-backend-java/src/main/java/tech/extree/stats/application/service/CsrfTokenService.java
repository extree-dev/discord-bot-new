package tech.extree.stats.application.service;

import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Service;

/**
 * CSRF-токен: random 32 байта, base64url. Double-submit cookie pattern:
 * токен кладётся в cookie `csrf` (SameSite=Strict, НЕ HttpOnly — фронт
 * должен читать) и дублируется в заголовке `X-CSRF-Token`. Сервер
 * проверяет, что cookie == header. Атакующий с другого origin не может
 * прочитать cookie → не может подделать header.
 *
 * Кеширования нет — токен одноразовый, выдаётся на GET /api/csrf-token,
 * фронт держит его в памяти (не localStorage).
 */
@Service
public class CsrfTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    public String generate() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}