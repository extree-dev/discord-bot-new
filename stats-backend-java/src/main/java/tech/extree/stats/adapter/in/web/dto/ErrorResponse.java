package tech.extree.stats.adapter.in.web.dto;

/** {"error": "..."} — форма ошибок /auth/* в server.js, snake_case-коды без изменений. */
public record ErrorResponse(String error) {}
