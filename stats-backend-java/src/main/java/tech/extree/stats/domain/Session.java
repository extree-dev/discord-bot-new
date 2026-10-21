package tech.extree.stats.domain;

/**
 * Расшифрованное содержимое сессионной cookie (см.
 * ../../stats-backend/server.js setSessionCookie) — два разных "вида"
 * одной cookie: {@code sub} для RSO-входа (Riot), {@code userId} для
 * входа email+паролем. Оба поля nullable — ровно одно из них заполнено
 * в зависимости от того, как пользователь вошёл.
 */
public record Session(String sub, String userId, long issuedAt) {

    public boolean isEmailAccount() {
        return userId != null;
    }
}
