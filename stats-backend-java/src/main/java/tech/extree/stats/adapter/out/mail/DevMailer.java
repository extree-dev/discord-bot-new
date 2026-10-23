package tech.extree.stats.adapter.out.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.Mailer;

/**
 * Заглушка ТОЛЬКО для локальной разработки (профиль dev).
 * Реальные письма не отправляет, коды в лог НЕ печатает —
 * чтобы случайно не утекли на прод и не приучали искать код в логах.
 * Если нужно увидеть код локально — временно добавь log.info сам,
 * но НЕ коммить это.
 */
@Component
@Profile("dev")
public class DevMailer implements Mailer {

    private static final Logger log = LoggerFactory.getLogger(DevMailer.class);

    private static void noop(String kind, String to) {
        log.debug("[DEV MAIL] {} → {} (письмо НЕ отправлено, профиль dev)", kind, to);
    }

    @Override public void sendVerificationCode(String email, String code) { noop("verification", email); }
    @Override public void sendNewLocationCode(String email, String code, String ip, String country, String city) { noop("new-location", email); }
    @Override public void sendSignInNotification(String email, String ip, String country, String city, String time) { noop("sign-in", email); }
    @Override public void sendPasswordResetEmail(String email, String resetUrl) { noop("password-reset", email); }
    @Override public void sendEmailChangeCode(String newEmail, String code) { noop("email-change-code", newEmail); }
    @Override public void sendEmailChangeNotice(String oldEmail, String newEmail) { noop("email-change-notice", oldEmail); }
    @Override public void sendEmailChanged(String to, String oldEmail, String newEmail) { noop("email-changed", to); }
    @Override public void sendPasswordChanged(String email, String ip, String country, String city, String time) { noop("password-changed", email); }
    @Override public void sendSupportTicketConfirmation(String email, long ticketNumber, String subject, String ticketUrl) { noop("ticket-confirmation", email); }
    @Override public void sendSupportTicketNotification(long ticketNumber, String email, String subject, String message, String category, String userId, String adminUrl) { noop("ticket-notification", email); }
    @Override public void sendSupportTicketReply(String email, long ticketNumber, String subject, String message, String adminName, String ticketUrl) { noop("ticket-reply", email); }
    @Override public void sendSupportTicketUserReply(long ticketNumber, String email, String subject, String message, String adminUrl) { noop("ticket-user-reply", email); }
}