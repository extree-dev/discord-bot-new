package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /auth/account/change-password. */
public record ChangePasswordRequest(String currentPassword, String newPassword) {}
