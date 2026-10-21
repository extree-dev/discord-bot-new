package tech.extree.stats.domain;

import java.time.Instant;

/** Зеркало строки stats_email_codes (см. ../../stats-backend/emailCodes.js). */
public record EmailCode(String code, int attempts, Instant expiresAt, Instant createdAt) {}
