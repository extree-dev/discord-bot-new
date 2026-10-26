package tech.extree.stats.application.service;

import java.util.Optional;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.port.in.GetSessionUseCase;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.domain.Session;

@Service
public class SessionService implements GetSessionUseCase {

    private final SessionCodec sessionCodec;

    public SessionService(SessionCodec sessionCodec) {
        this.sessionCodec = sessionCodec;
    }

    @Override
    public Optional<Session> getSession(String cookieValue) {
        if (cookieValue == null) {
            return Optional.empty();
        }
        return sessionCodec.decrypt(cookieValue);
    }
}
