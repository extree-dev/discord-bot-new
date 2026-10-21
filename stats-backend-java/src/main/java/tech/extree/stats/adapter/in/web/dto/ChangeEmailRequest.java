package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /auth/account/change-email. */
public record ChangeEmailRequest(String currentPassword, String newEmail) {}
