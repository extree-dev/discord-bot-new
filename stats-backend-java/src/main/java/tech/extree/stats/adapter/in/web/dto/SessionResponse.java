package tech.extree.stats.adapter.in.web.dto;

/** Форма ответа GET /api/session — зеркалит {@code { user: { sub } | null } } из server.js. */
public record SessionResponse(UserRef user) {
    public record UserRef(String sub) {}

    public static SessionResponse empty() {
        return new SessionResponse(null);
    }
}
