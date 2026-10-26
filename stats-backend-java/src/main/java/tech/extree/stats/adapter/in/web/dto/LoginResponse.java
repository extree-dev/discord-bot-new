package tech.extree.stats.adapter.in.web.dto;

/** {"ok": true, "user": {"email": "..."}} — ответ server.js на успешный вход. */
public record LoginResponse(boolean ok, LoginUser user) {
    public record LoginUser(String email) {}
}
