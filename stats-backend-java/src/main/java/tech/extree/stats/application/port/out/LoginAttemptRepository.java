package tech.extree.stats.application.port.out;

import java.time.Instant;

/** Порт для записи/чтения stats_login_attempts. */
public interface LoginAttemptRepository {

    void record(String email, String ip, String country, boolean success, String reason);

    /** Сколько неудачных попыток за период (для rate-limit per email). */
    int countFailuresSince(String email, Instant since);
}