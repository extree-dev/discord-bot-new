package tech.extree.stats.adapter.in.web.dto;

/** {"ok": true} — ответ server.js на успешные /auth/register и /auth/resend-code. */
public record OkResponse(boolean ok) {
    public static final OkResponse OK = new OkResponse(true);
}
