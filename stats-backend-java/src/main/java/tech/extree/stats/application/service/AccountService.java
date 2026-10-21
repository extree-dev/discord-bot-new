package tech.extree.stats.application.service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.port.in.GetAccountUseCase;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

/** Соответствует requireAdmin/GET api/account/me в server.js. */
@Service
public class AccountService implements GetAccountUseCase {

    private final SessionCodec sessionCodec;
    private final UserRepository userRepository;
    private final Set<String> supportAdminEmails;

    public AccountService(
            SessionCodec sessionCodec,
            UserRepository userRepository,
            @Value("${extree.support-admin-emails:}") String supportAdminEmailsRaw) {
        this.sessionCodec = sessionCodec;
        this.userRepository = userRepository;
        this.supportAdminEmails =
                List.of(supportAdminEmailsRaw.split(",")).stream()
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(s -> s.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public Optional<User> getAccount(String cookieValue) {
        if (cookieValue == null) {
            return Optional.empty();
        }
        Optional<Session> session = sessionCodec.decrypt(cookieValue);
        if (session.isEmpty() || session.get().userId() == null) {
            return Optional.empty();
        }
        return userRepository.findById(session.get().userId());
    }

    @Override
    public boolean isAdmin(User user) {
        return supportAdminEmails.contains(user.email().toLowerCase(Locale.ROOT));
    }
}
