package tech.extree.stats.application.port.out;

import java.util.Optional;
import tech.extree.stats.domain.User;

/**
 * Выходной порт — то, что application-слою нужно от хранилища
 * пользователей, без привязки к Postgres/JDBC. Реализация —
 * adapter/out/persistence/JdbcUserRepository.
 */
public interface UserRepository {
    Optional<User> findById(String id);

    Optional<User> findByEmail(String email);

    /**
     * Создаёт аккаунт или перезаписывает уже существующий, но ещё не
     * подтверждённый (см. upsertUnverifiedUser в users.js — опечатавшийся
     * в первой попытке пользователь не должен застревать). Бросает
     * NicknameTakenException, если никнейм занят другим аккаунтом
     * (UNIQUE(nickname) в схеме).
     */
    User upsertUnverifiedUser(String email, String passwordHash, String name, String nickname);

    Optional<User> markEmailVerified(String email);
}
