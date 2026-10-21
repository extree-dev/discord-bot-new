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
}
