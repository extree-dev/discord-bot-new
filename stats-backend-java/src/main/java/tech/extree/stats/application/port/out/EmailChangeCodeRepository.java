package tech.extree.stats.application.port.out;

import java.time.Instant;
import java.util.Optional;
import tech.extree.stats.domain.EmailChangeCode;

/** Соответствует emailChangeCodes.js (Node) — stats_email_change_codes, ключ user_id. */
public interface EmailChangeCodeRepository {
    void upsertCode(String userId, String newEmail, String code, Instant expiresAt);

    Optional<EmailChangeCode> getCode(String userId);

    void registerFailedAttempt(String userId);

    void deleteCode(String userId);
}
