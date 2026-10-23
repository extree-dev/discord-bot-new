package tech.extree.stats.domain;

import java.time.Instant;

/** Зеркало строки stats_login_attempts. */
public record LoginAttempt(
        String email,
        String ip,
        String country,
        boolean success,
        String reason,
        Instant createdAt) {}