package tech.extree.stats.application.port.in;

import java.util.Optional;
import tech.extree.stats.domain.User;

/** Соответствует GET /api/account/me в server.js. */
public interface GetAccountUseCase {
    /** Пусто, если нет сессии или сессия указывает на уже не существующего пользователя. */
    Optional<User> getAccount(String cookieValue);

    boolean isAdmin(User user);
}
