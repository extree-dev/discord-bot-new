package tech.extree.stats.application.port.in;

import java.util.Optional;
import tech.extree.stats.domain.Session;

/** Соответствует GET /api/session в server.js — просто читает и расшифровывает cookie. */
public interface GetSessionUseCase {
    Optional<Session> getSession(String cookieValue);
}
