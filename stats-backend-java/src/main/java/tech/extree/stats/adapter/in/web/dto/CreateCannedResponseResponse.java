package tech.extree.stats.adapter.in.web.dto;

/** {"ok": true, "id": "..."} — ответ POST /api/admin/canned-responses. */
public record CreateCannedResponseResponse(boolean ok, String id) {}
