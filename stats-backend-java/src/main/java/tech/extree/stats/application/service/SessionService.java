package tech.extree.stats.application.service;

import java.util.Optional;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.port.in.GetSessionUseCase;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.domain.LoginSession;

@Service
public class SessionService implements GetSessionUseCase {

    private final SessionRepository sessionRepository;

    public SessionService(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    @Override
    public Optional<LoginSession> getSession(String cookieValue) {
        if (cookieValue == null) {
            return Optional.empty();
        }
        return sessionRepository.validate(cookieValue);
    }
}
