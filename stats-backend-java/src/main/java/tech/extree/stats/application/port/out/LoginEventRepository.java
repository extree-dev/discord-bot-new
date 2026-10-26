package tech.extree.stats.application.port.out;

import java.util.List;
import java.util.Optional;
import tech.extree.stats.domain.LoginEvent;

/** Соответствует loginEvents.js (Node) — журнал "Recent sign-ins" в stats_login_events. */
public interface LoginEventRepository {
    /** sessionId — id (хэш) записи в stats_sessions для привязки "Remove" к реальному отзыву токена, см. SessionRepository. */
    void recordLogin(String userId, String ip, String country, String city, String userAgent, String sessionId);

    /** limit=10 в server.js (LIST_LIMIT в loginEvents.js) — то же значение по умолчанию. */
    List<LoginEvent> listRecent(String userId, int limit);

    /** Пусто — нет такой записи (или чужая), или она есть, но без привязанной сессии (старая запись/RSO) — в обоих случаях нечего отзывать. */
    Optional<String> findSessionId(String userId, String eventId);

    /** Удалить запись (logout сессии). Возвращает true, если запись была и принадлежала userId. */
    boolean deleteById(String userId, String eventId);
}