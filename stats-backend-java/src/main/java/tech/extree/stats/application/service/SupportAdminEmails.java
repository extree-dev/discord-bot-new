package tech.extree.stats.application.service;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tech.extree.stats.domain.User;

/**
 * Белый список email с доступом к /admin/tickets — зеркалит
 * SUPPORT_ADMIN_EMAILS/requireAdmin в server.js. Общий компонент
 * (AccountService для isAdmin в /api/account/me, AdminTicketService для
 * самой проверки доступа к админке) вместо дублирования парсинга.
 */
@Component
public class SupportAdminEmails {

    private final Set<String> emails;

    public SupportAdminEmails(@Value("${extree.support-admin-emails:}") String rawEmails) {
        this.emails = List.of(rawEmails.split(",")).stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdmin(User user) {
        return emails.contains(user.email().toLowerCase(Locale.ROOT));
    }
}
