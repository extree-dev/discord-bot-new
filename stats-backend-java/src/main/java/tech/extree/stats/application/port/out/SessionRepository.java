package tech.extree.stats.application.port.out;

import java.util.Optional;
import tech.extree.stats.domain.LoginSession;

/**
 * Серверный реестр сессий (stats_sessions) — заменяет чисто stateless
 * AES-GCM cookie (см. {@link SessionCodec}, который теперь обслуживает
 * только Pre2faService). Реальная выгода: "Remove" в Recent Sign-ins
 * (см. LoginEventController) теперь по-настоящему отзывает устройство, а
 * не просто чистит историю — токен, который держит браузер, перестаёт
 * проходить validate() сразу после revoke/revokeById.
 */
public interface SessionRepository {

    /** token — в cookie; id — его хэш, для связки с записью в Recent Sign-ins (LoginEventRepository.recordLogin). */
    record Created(String token, String id) {}

    /**
     * Создаёт новую сессию и возвращает "сырой" токен для cookie — его
     * хэш (не сам токен) уходит в базу, ровно как с токенами сброса
     * пароля. Ровно один из sub/userId должен быть не-null (RSO-вход
     * против email-аккаунта), второй передаётся null.
     */
    Created create(String sub, String userId, String ip, String userAgent, boolean rememberMe);

    /** Пустой Optional на любую проблему — не найдена, отозвана, просрочена, не распарсился токен. */
    Optional<LoginSession> validate(String rawToken);

    /** Отзывает сессию по токену из cookie (logout текущего устройства). */
    void revoke(String rawToken);

    /** Отзывает сессию по её id — для "Remove" по конкретной записи истории входов, принадлежащей userId. */
    void revokeById(String userId, String sessionId);
}
