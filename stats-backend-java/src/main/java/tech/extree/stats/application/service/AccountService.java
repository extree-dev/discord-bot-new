package tech.extree.stats.application.service;

import java.util.Optional;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.port.in.GetAccountUseCase;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

@Service
public class AccountService implements GetAccountUseCase {

    private final SessionCodec sessionCodec;
    private final UserRepository userRepository;
    private final SupportAdminEmails supportAdminEmails;

    public AccountService(SessionCodec sessionCodec, UserRepository userRepository, SupportAdminEmails supportAdminEmails) {
        this.sessionCodec = sessionCodec;
        this.userRepository = userRepository;
        this.supportAdminEmails = supportAdminEmails;
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
        
        Optional<User> user = userRepository.findById(session.get().userId());
        if (user.isPresent() && user.get().isBanned()) {
            return Optional.empty();
        }
        
        return user;
    }

    @Override
    public boolean isAdmin(User user) {
        return supportAdminEmails.isAdmin(user);
    }
}
