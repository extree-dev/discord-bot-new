package tech.extree.stats.application.service;

import org.springframework.stereotype.Component;
import tech.extree.stats.domain.User;

@Component
public class SupportAdminEmails {
    // Заглушка, так как теперь админка хранится в БД (User.isAdmin)
    public boolean isAdmin(User user) {
        return user != null && user.isAdmin();
    }
}