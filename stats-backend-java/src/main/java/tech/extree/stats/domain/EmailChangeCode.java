package tech.extree.stats.domain;

import java.time.Instant;

/** Зеркало строки stats_email_change_codes (см. ../../stats-backend/emailChangeCodes.js). */
public record EmailChangeCode(String newEmail, String code, int attempts, Instant expiresAt, Instant createdAt) {}
