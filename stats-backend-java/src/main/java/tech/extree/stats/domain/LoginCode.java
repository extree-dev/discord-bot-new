package tech.extree.stats.domain;

import java.time.Instant;

/** Зеркало строки stats_login_codes (см. ../../stats-backend/loginCodes.js). */
public record LoginCode(
        String code,
        int attempts,
        String ip,
        String country,
        String city,
        boolean remember,
        Instant expiresAt,
        Instant createdAt) {}
