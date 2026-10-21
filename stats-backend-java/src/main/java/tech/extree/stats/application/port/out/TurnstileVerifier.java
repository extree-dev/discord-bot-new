package tech.extree.stats.application.port.out;

/**
 * Соответствует turnstile.js (Node): проверка Cloudflare Turnstile token
 * через siteverify. Fail-closed — false на любую проблему (нет ключа,
 * невалидный токен, сетевая ошибка), никогда не бросает.
 */
public interface TurnstileVerifier {
    boolean verify(String token, String remoteIp);
}
