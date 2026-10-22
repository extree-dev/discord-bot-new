package tech.extree.stats.adapter.out.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.Mailer;

/**
 * Заглушка для локальной разработки (профиль dev).
 * Не отправляет реальные письма, а выводит данные в консоль.
 */
@Component
@Profile("dev")
public class DevMailer implements Mailer {

    private static final Logger log = LoggerFactory.getLogger(DevMailer.class);

    @Override
    public void sendVerificationCode(String email, String code) {
        log.warn("\n==================================================");
        log.warn("ЛОКАЛЬНАЯ РАЗРАБОТКА (DEV)");
        log.warn("Письмо НЕ отправлено на {}", email);
        log.warn("ВАШ КОД ПОДТВЕРЖДЕНИЯ: {}", code);
        log.warn("==================================================\n");
    }

    @Override
    public void sendSupportTicketUserReply(long ticketId, String email, String subject, String message, String adminName) {
        log.warn("[DEV MAIL] Ответ в тикет #{} на {}: {}", ticketId, email, message);
    }

    @Override
    public void sendPasswordResetEmail(String email, String code) {
        log.warn("[DEV MAIL] Код сброса пароля для {}: {}", email, code);
    }

    @Override
    public void sendSupportTicketNotification(long ticketId, String email, String subject, String message, String name, String nickname, String category) {
        log.warn("[DEV MAIL] Уведомление о тикете #{} на {}", ticketId, email);
    }

    @Override
    public void sendNewLocationCode(String email, String code, String ip, String country, String city) {
        log.warn("[DEV MAIL] Код входа из нового места для {}: {}", email, code);
    }

    @Override
    public void sendPasswordChanged(String email, String ip, String country, String city, String time) {
        log.warn("[DEV MAIL] Уведомление о смене пароля для {}", email);
    }

    @Override
    public void sendSignInNotification(String email, String ip, String country, String city, String time) {
        log.warn("[DEV MAIL] Уведомление о входе для {}", email);
    }

    @Override
    public void sendSupportTicketConfirmation(String email, long ticketId, String subject, String message) {
        log.warn("[DEV MAIL] Подтверждение создания тикета #{} для {}", ticketId, email);
    }

    @Override
    public void sendSupportTicketReply(String email, long ticketId, String subject, String message, String adminName, String adminReply) {
        log.warn("[DEV MAIL] Ответ на тикет #{} для {}", ticketId, email);
    }

    @Override
    public void sendEmailChanged(String email, String newEmail, String time) {
        log.warn("[DEV MAIL] Email изменен с {} на {}", email, newEmail);
    }

    @Override
    public void sendEmailChangeNotice(String oldEmail, String newEmail) {
        log.warn("[DEV MAIL] Уведомление о смене email с {} на {}", oldEmail, newEmail);
    }

    @Override
    public void sendEmailChangeCode(String email, String code) {
        log.warn("\n==================================================");
        log.warn("ЛОКАЛЬНАЯ РАЗРАБОТКА (DEV)");
        log.warn("Код для смены email отправлен на {}", email);
        log.warn("ВАШ КОД: {}", code);
        log.warn("==================================================\n");
    }
}