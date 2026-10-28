package tech.extree.stats.application.port.out;

import java.util.List;
import java.util.Optional;
import tech.extree.stats.domain.User;

public interface UserRepository {
    Optional<User> findById(String id);
    Optional<User> findByEmail(String email);
    User upsertUnverifiedUser(String email, String passwordHash, String name, String nickname);
    Optional<User> markEmailVerified(String email);
    Optional<User> updatePasswordHash(String userId, String passwordHash);
    Optional<User> updateEmail(String userId, String newEmail);
    void updateAvatar(String userId, String avatarUrl);
    void setVerified(String userId, boolean isVerified);
    void setBanned(String userId, boolean isBanned);
    void setAdmin(String userId, boolean isAdmin); // <-- НОВЫЙ МЕТОД

    /** Необратимо — связанные строки (сессии, тикеты, TOTP-секрет и т.д.) уходят через ON DELETE CASCADE. */
    void deleteById(String userId);

    List<User> findAllUsers();

    /** Поиск для админ-палитры (Cmd+K): по email/name/nickname, LIMIT 5. */
    List<User> searchUsers(String likeQuery);
}