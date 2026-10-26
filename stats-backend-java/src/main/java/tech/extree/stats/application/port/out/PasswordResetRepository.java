package tech.extree.stats.application.port.out;

import java.util.Optional;
import tech.extree.stats.domain.PasswordReset;

/** Соответствует passwordResets.js (Node) — stats_password_resets. */
public interface PasswordResetRepository {
    /** Удаляет предыдущие токены этого пользователя, создаёт новый, возвращает его. */
    String createReset(String userId, String email);

    Optional<PasswordReset> getReset(String token);

    void deleteReset(String token);

    boolean isOnCooldown(String email);
}
