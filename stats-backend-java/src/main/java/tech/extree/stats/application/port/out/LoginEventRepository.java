package tech.extree.stats.application.port.out;

/** Соответствует loginEvents.js (Node) — журнал "Recent sign-ins" в stats_login_events. */
public interface LoginEventRepository {
    void recordLogin(String userId, String ip, String country, String city);
}
