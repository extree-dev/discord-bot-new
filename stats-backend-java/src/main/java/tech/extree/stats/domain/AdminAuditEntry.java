package tech.extree.stats.domain;

import java.time.Instant;

/** Зеркало строки stats_admin_audit. */
public record AdminAuditEntry(
        long id,
        String adminId,
        String adminEmail,
        String action,
        String targetType,
        String targetId,
        String metadata,
        String ip,
        Instant createdAt) {}