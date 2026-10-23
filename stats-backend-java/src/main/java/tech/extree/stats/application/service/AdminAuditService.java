package tech.extree.stats.application.service;

import org.springframework.stereotype.Service;
import tech.extree.stats.application.port.out.AdminAuditRepository;

/**
 * SRP: только запись админ-аудита. Контроллеры/сервисы вызывают record()
 * после успешной операции — без бизнес-логики (только «что произошло»).
 */
@Service
public class AdminAuditService {

    private final AdminAuditRepository auditRepository;

    public AdminAuditService(AdminAuditRepository auditRepository) {
        this.auditRepository = auditRepository;
    }

    public void record(
            String adminId,
            String action,
            String targetType,
            String targetId,
            String metadataJson,
            String ip) {
        auditRepository.record(adminId, action, targetType, targetId, metadataJson, ip);
    }
}