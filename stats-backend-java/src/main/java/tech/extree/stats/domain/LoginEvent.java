package tech.extree.stats.domain;

import java.time.Instant;

/** Зеркало строки stats_login_events (см. ../../stats-backend/loginEvents.js). */
public record LoginEvent(String id, String ip, String country, String city, Instant createdAt, String userAgent) {}
