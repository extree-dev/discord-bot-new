package tech.extree.stats.adapter.in.web.dto;

/** {"ok": true, "user": {"email": "..."}} — ответ server.js на успешный /auth/verify. */
public record VerifyResponse(boolean ok, VerifyUser user) {
    public record VerifyUser(String email) {}
}
