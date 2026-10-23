package tech.extree.stats.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import tech.extree.stats.domain.TotpSecret;

/** Порт для stats_user_totp_secrets. */
public interface TotpRepository {

    Optional<TotpSecret> findByUserId(String userId);

    /** Создать pending-секрет (enabled_at = null). */
    void upsertPending(String userId, String secret, List<String> recoveryCodesHashed);

    /** Активировать (после проверки кода). */
    void enable(String userId, Instant now);

    /** Удалить полностью (отключение 2FA). */
    void delete(String userId);

    /** Обновить recovery-коды (при перевыпуске). */
    void updateRecoveryCodes(String userId, List<String> hashedCodes);

    /** Убрать использованный recovery-код. */
    void removeRecoveryCode(String userId, String hashedCode);
}