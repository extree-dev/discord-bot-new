package tech.extree.stats.application.port.in;

import java.util.Optional;
import tech.extree.stats.domain.LoginSession;

/** Соответствует GET /api/session в server.js — читает и валидирует cookie по серверному реестру сессий. */
public interface GetSessionUseCase {
    Optional<LoginSession> getSession(String cookieValue);
}
