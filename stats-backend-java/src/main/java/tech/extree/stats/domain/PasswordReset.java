package tech.extree.stats.domain;

import java.time.Instant;

/** Зеркало строки stats_password_resets (см. ../../stats-backend/passwordResets.js). */
public record PasswordReset(String token, String userId, String email, Instant expiresAt, Instant createdAt) {}
