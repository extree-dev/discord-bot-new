package tech.extree.stats.application.port.out;

import java.util.List;
import tech.extree.stats.domain.AdminAuditEntry;

/** Порт для stats_admin_audit. */
public interface AdminAuditRepository {

    void record(String adminId, String action, String targetType, String targetId, String metadata, String ip);

    /** Список с пагинацией, новые сверху. */
    List<AdminAuditEntry> list(int limit, int offset);
}