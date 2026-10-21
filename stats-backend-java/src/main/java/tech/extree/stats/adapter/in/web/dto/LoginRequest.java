package tech.extree.stats.adapter.in.web.dto;

/**
 * Тело POST /auth/login. rememberMe — Boolean (не boolean), чтобы
 * отличить "поле отсутствует" от "false": как и в Node
 * (req.body?.rememberMe !== false), отсутствующее поле значит "помнить".
 */
public record LoginRequest(String email, String password, String turnstileToken, Boolean rememberMe) {
    public boolean rememberMeOrDefault() {
        return rememberMe == null || rememberMe;
    }
}
