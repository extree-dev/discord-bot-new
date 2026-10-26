package tech.extree.stats.application.port.out;

import java.util.List;
import tech.extree.stats.domain.LoginEvent;

/** Соответствует loginEvents.js (Node) — журнал "Recent sign-ins" в stats_login_events. */
public interface LoginEventRepository {
    void recordLogin(String userId, String ip, String country, String city, String userAgent);

    /** limit=10 в server.js (LIST_LIMIT в loginEvents.js) — то же значение по умолчанию. */
    List<LoginEvent> listRecent(String userId, int limit);
    /** Удалить запись (logout сессии). Возвращает true, если запись была и принадлежала userId. */
    boolean deleteById(String userId, String eventId);
}