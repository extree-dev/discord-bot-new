package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /auth/reset-password. */
public record ResetPasswordRequest(String token, String password) {}
