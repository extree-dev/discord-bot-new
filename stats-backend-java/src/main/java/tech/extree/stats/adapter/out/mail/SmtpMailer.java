package tech.extree.stats.adapter.out.mail;

import jakarta.mail.internet.MimeMessage;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.Mailer;

// "!dev" — иначе при профиле dev было бы два бина Mailer (этот и
// DevMailer, у которого @Profile("dev")) и Spring падал бы на старте с
// неоднозначностью внедрения. Раньше профиль dev никто не запускал, так
// что этот конфликт был безобидной мёртвой веткой кода — теперь это и
// есть точка входа для локального запуска.
@Component
@Profile("!dev")
public class SmtpMailer implements Mailer {

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public SmtpMailer(
            JavaMailSender mailSender,
            @Value("${extree.mail-from:}") String configuredFrom,
            @Value("${spring.mail.username:}") String mailUser) {
        this.mailSender = mailSender;
        this.fromAddress =
                (configuredFrom == null || configuredFrom.isBlank())
                        ? "Extree Stats <" + mailUser + ">"
                        : configuredFrom;
    }

    @Override
    public void sendVerificationCode(String email, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("Verify your email — Extree Stats");
            helper.setText(renderVerificationEmail(code), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить письмо с кодом подтверждения", e);
        }
    }

    @Override
    public void sendNewLocationCode(String email, String code, String ip, String country, String city) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("Confirm this sign-in — Extree Stats");
            helper.setText(renderNewLocationCodeEmail(code, ip, country, city), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить письмо с кодом подтверждения нового места входа", e);
        }
    }    @Override
    @Async
    public void sendPasswordResetEmail(String email, String resetUrl) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("Reset your password — Extree Stats");
            helper.setText(renderPasswordResetEmail(resetUrl), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить письмо сброса пароля", e);
        }
    }    @Override
    @Async
    public void sendEmailChangeCode(String newEmail, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(newEmail);
            helper.setSubject("Confirm your new email — Extree Stats");
            helper.setText(renderEmailChangeCodeEmail(code), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить письмо с кодом смены email", e);
        }
    }    @Override
    @Async
    public void sendEmailChangeNotice(String oldEmail, String newEmail) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(oldEmail);
            helper.setSubject("Email change requested — Extree Stats");
            helper.setText(renderEmailChangeNoticeEmail(newEmail), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить уведомление о запросе смены email", e);
        }
    }    @Override
    @Async
    public void sendEmailChanged(String to, String oldEmail, String newEmail) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject("Your email was changed — Extree Stats");
            helper.setText(renderEmailChangedEmail(oldEmail, newEmail), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить подтверждение смены email", e);
        }
    }    @Override
    @Async
    public void sendPasswordChanged(String email, String ip, String country, String city, String time) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("Your password was changed — Extree Stats");
            helper.setText(renderPasswordChangedEmail(ip, country, city, time), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить уведомление о смене пароля", e);
        }
    }    @Override
    @Async
    public void sendSupportTicketConfirmation(String email, long ticketNumber, String subject, String ticketUrl) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("We got your request — Extree Stats #" + ticketNumber);
            helper.setText(renderSupportTicketConfirmationEmail(ticketNumber, subject, ticketUrl), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить подтверждение заявки в поддержку", e);
        }
    }    @Override
    @Async
    public void sendSupportTicketNotification(
            long ticketNumber, String email, String subject, String message, String category, String userId, String adminUrl) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo("support@extree.tech");
            helper.setReplyTo(email);
            helper.setSubject("[Ticket #" + ticketNumber + "] " + subject);
            helper.setText(
                    renderSupportTicketNotificationEmail(ticketNumber, email, subject, message, category, userId, adminUrl),
                    true);
            mailSender.send(mimeMessage);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить уведомление команде поддержки о новой заявке", e);
        }
    }    @Override
    @Async
    public void sendSupportTicketReply(
            String email, long ticketNumber, String subject, String message, String adminName, String ticketUrl) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("Re: " + subject + " — Extree Stats #" + ticketNumber);
            helper.setText(renderSupportTicketReplyEmail(ticketNumber, message, adminName, ticketUrl), true);
            mailSender.send(mimeMessage);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить уведомление об ответе на тикет", e);
        }
    }    @Override
    @Async
    public void sendSupportTicketUserReply(long ticketNumber, String email, String subject, String message, String adminUrl) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo("support@extree.tech");
            helper.setReplyTo(email);
            helper.setSubject("Re: [Ticket #" + ticketNumber + "] " + subject);
            helper.setText(renderSupportTicketUserReplyEmail(ticketNumber, email, subject, message, adminUrl), true);
            mailSender.send(mimeMessage);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить уведомление команде поддержки об ответе пользователя", e);
        }
    }    @Override
    @Async
    public void sendSignInNotification(String email, String ip, String country, String city, String time) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("New sign-in to your account — Extree Stats");
            helper.setText(renderSignInNotificationEmail(ip, country, city, time), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить письмо-уведомление о входе", e);
        }
    }

    @Override
    @Async
    public void sendFailedLoginAlert(String email, String ip, String country, String time) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("Multiple failed sign-in attempts — Extree Stats");
            helper.setText(renderSignInNotificationEmail(ip, country, null, time), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось отправить письмо об неудачных попытках входа", e);
        }
    }

    private static String formatLocation(String country, String city) {
        if (country == null) {
            return "an unknown location";
        }
        return city != null ? city + ", " + country : country;
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private static final Map<String, String> SUPPORT_CATEGORY_LABELS =
            Map.of("account", "Account & login", "bug", "Bug report", "billing", "Billing", "other", "Other");

    private static String renderSupportTicketConfirmationEmail(long ticketNumber, String subject, String ticketUrl) {
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<meta name=\"color-scheme\" content=\"light\">\n"
                + "<meta name=\"supported-color-schemes\" content=\"light\">\n"
                + "<title>We got your request</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#ffffff;-webkit-font-smoothing:antialiased;\">\n"
                + "<div style=\"display:none;font-size:1px;line-height:1px;color:#ffffff;max-height:0;max-width:0;"
                + "opacity:0;overflow:hidden;\">\n"
                + "We got your support request. Ticket #" + ticketNumber + ".\n"
                + "</div>\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#ffffff;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"\n"
                + "         style=\"max-width:580px;width:100%;\n"
                + "                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,"
                + "Arial,sans-serif;\n"
                + "                color:#1a1a1a;padding:32px 24px;\">\n"
                + "    <tr><td style=\"padding-bottom:24px;font-size:12.5px;color:#888888;\">\n"
                + "      Extree Stats Support\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"font-size:15px;line-height:1.7;\">\n"
                + "      Hi there,<br><br>\n"
                + "      Thanks for reaching out — we got your message (<strong>" + escapeHtml(subject)
                + "</strong>) and will reply as soon as we can.\n"
                + "      <br><br>\n"
                + "      You can view it, and reply whenever you want, here: <a href=\"" + ticketUrl
                + "\" style=\"color:#ff4d5e;\">" + ticketUrl + "</a>.\n"
                + "      We'll also email you the moment we reply.\n"
                + "      <br><br>\n"
                + "      Best regards,<br>\n"
                + "      Extree Stats Support\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding-top:32px;\">\n"
                + "      <hr style=\"border:none;border-top:1px solid #e5e5e5;margin:0 0 16px;\">\n"
                + "      <p style=\"margin:0;font-size:12.5px;line-height:1.6;color:#999999;\">\n"
                + "        Ticket #" + escapeHtml(String.valueOf(ticketNumber)) + ". Didn't send this request? "
                + "Contact\n"
                + "        <a href=\"mailto:support@extree.tech\" style=\"color:#999999;\">support@extree.tech</a>.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderSupportTicketReplyEmail(long ticketNumber, String message, String adminName, String ticketUrl) {
        String safeAdminName = escapeHtml(adminName);
        String ticketLabel = escapeHtml(String.valueOf(ticketNumber));
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<meta name=\"color-scheme\" content=\"light\">\n"
                + "<meta name=\"supported-color-schemes\" content=\"light\">\n"
                + "<title>New reply to your ticket</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#ffffff;-webkit-font-smoothing:antialiased;\">\n"
                + "<div style=\"display:none;font-size:1px;line-height:1px;color:#ffffff;max-height:0;max-width:0;"
                + "opacity:0;overflow:hidden;\">\n"
                + safeAdminName + " replied to your support ticket #" + ticketLabel + ".\n"
                + "</div>\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#ffffff;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"\n"
                + "         style=\"max-width:580px;width:100%;\n"
                + "                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,"
                + "Arial,sans-serif;\n"
                + "                color:#1a1a1a;padding:32px 24px;\">\n"
                + "    <tr><td style=\"padding-bottom:24px;\">\n"
                + "      <span style=\"font-size:14px;font-weight:700;\">" + safeAdminName + "</span>\n"
                + "      <span style=\"font-size:12.5px;color:#888888;\"> (Extree Stats Support)</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"font-size:15px;line-height:1.7;white-space:pre-wrap;\">" + escapeHtml(message)
                + "</td></tr>\n"
                + "    <tr><td style=\"padding-top:24px;font-size:15px;line-height:1.7;\">\n"
                + "      Best regards,<br>\n"
                + "      " + safeAdminName + "<br>\n"
                + "      Extree Stats Support\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding-top:32px;\">\n"
                + "      <hr style=\"border:none;border-top:1px solid #e5e5e5;margin:0 0 16px;\">\n"
                + "      <p style=\"margin:0;font-size:12.5px;line-height:1.6;color:#999999;\">\n"
                + "        Reply on ticket #" + ticketLabel + ": <a href=\"" + ticketUrl
                + "\" style=\"color:#999999;\">" + ticketUrl + "</a>.\n"
                + "        Didn't open this ticket? Contact\n"
                + "        <a href=\"mailto:support@extree.tech\" style=\"color:#999999;\">support@extree.tech</a>.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderSupportTicketNotificationEmail(
            long ticketNumber, String email, String subject, String message, String category, String userId, String adminUrl) {
        String categoryLabel = SUPPORT_CATEGORY_LABELS.getOrDefault(category, "Other");
        String fromLine = escapeHtml(email) + (userId != null ? " (signed in)" : " (not signed in)");
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<title>New support ticket</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,"
                + "BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:32px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"max-width:560px;width:100%;background:#ffffff;border-radius:12px;color:#111111;\">\n"
                + "    <tr><td style=\"padding:28px 32px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:18px;font-weight:700;\">New Extree Stats support ticket</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 32px 0;\">\n"
                + "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "border=\"0\" style=\"font-size:13.5px;color:#333333;\">\n"
                + "        <tr><td style=\"padding:4px 0;color:#888888;width:84px;\">Ticket</td>"
                + "<td style=\"padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;\">#"
                + escapeHtml(String.valueOf(ticketNumber)) + "</td></tr>\n"
                + "        <tr><td style=\"padding:4px 0;color:#888888;\">From</td>"
                + "<td style=\"padding:4px 0;\">" + fromLine + "</td></tr>\n"
                + "        <tr><td style=\"padding:4px 0;color:#888888;\">Category</td>"
                + "<td style=\"padding:4px 0;\">" + escapeHtml(categoryLabel) + "</td></tr>\n"
                + "        <tr><td style=\"padding:4px 0;color:#888888;\">Subject</td>"
                + "<td style=\"padding:4px 0;\">" + escapeHtml(subject) + "</td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:20px 32px 0;\">\n"
                + "      <p style=\"margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;"
                + "letter-spacing:0.04em;color:#888888;\">Message</p>\n"
                + "      <p style=\"margin:0;font-size:14px;line-height:1.6;color:#111111;white-space:pre-wrap;\">"
                + escapeHtml(message) + "</p>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:24px 32px 28px;\">\n"
                + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n"
                + "        <tr><td style=\"background:#ff4d5e;border-radius:10px;\">\n"
                + "          <a href=\"" + adminUrl + "\" style=\"display:inline-block;padding:12px 24px;"
                + "font-size:13.5px;font-weight:700;\n"
                + "             color:#ffffff;text-decoration:none;\">Reply in admin</a>\n"
                + "        </td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderSupportTicketUserReplyEmail(
            long ticketNumber, String email, String subject, String message, String adminUrl) {
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<title>New reply on a support ticket</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,"
                + "BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:32px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"max-width:560px;width:100%;background:#ffffff;border-radius:12px;color:#111111;\">\n"
                + "    <tr><td style=\"padding:28px 32px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:18px;font-weight:700;\">New reply on an Extree Stats "
                + "ticket</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 32px 0;\">\n"
                + "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "border=\"0\" style=\"font-size:13.5px;color:#333333;\">\n"
                + "        <tr><td style=\"padding:4px 0;color:#888888;width:84px;\">Ticket</td>"
                + "<td style=\"padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;\">#"
                + escapeHtml(String.valueOf(ticketNumber)) + "</td></tr>\n"
                + "        <tr><td style=\"padding:4px 0;color:#888888;\">From</td>"
                + "<td style=\"padding:4px 0;\">" + escapeHtml(email) + "</td></tr>\n"
                + "        <tr><td style=\"padding:4px 0;color:#888888;\">Subject</td>"
                + "<td style=\"padding:4px 0;\">" + escapeHtml(subject) + "</td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:20px 32px 0;\">\n"
                + "      <p style=\"margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;"
                + "letter-spacing:0.04em;color:#888888;\">Reply</p>\n"
                + "      <p style=\"margin:0;font-size:14px;line-height:1.6;color:#111111;white-space:pre-wrap;\">"
                + escapeHtml(message) + "</p>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:24px 32px 28px;\">\n"
                + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n"
                + "        <tr><td style=\"background:#ff4d5e;border-radius:10px;\">\n"
                + "          <a href=\"" + adminUrl + "\" style=\"display:inline-block;padding:12px 24px;"
                + "font-size:13.5px;font-weight:700;\n"
                + "             color:#ffffff;text-decoration:none;\">Reply in admin</a>\n"
                + "        </td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderPasswordResetEmail(String resetUrl) {
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<meta name=\"color-scheme\" content=\"light\">\n"
                + "<meta name=\"supported-color-schemes\" content=\"light\">\n"
                + "<title>Reset your password</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;\">\n"
                + "<div style=\"display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;"
                + "opacity:0;overflow:hidden;\">\n"
                + "Reset your Extree Stats password. This link expires in 30 minutes.\n"
                + "</div>\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"\n"
                + "         style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;\n"
                + "                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,"
                + "Arial,sans-serif;\n"
                + "                color:#111111;\">\n"
                + "    <tr><td style=\"padding:40px 40px 0;\">\n"
                + "      <span style=\"font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;\">"
                + "Extree</span>\n"
                + "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;"
                + "font-weight:700;\n"
                + "                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;"
                + "vertical-align:middle;\">STATS</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:22px;line-height:1.3;font-weight:600;"
                + "letter-spacing:-0.3px;\">Reset your password</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 0;\">\n"
                + "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">\n"
                + "        We got a request to reset the password for your Extree Stats account. Click the button "
                + "below to choose a\n"
                + "        new one.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:28px 40px 0;\">\n"
                + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n"
                + "        <tr><td style=\"background:#ff4d5e;border-radius:10px;\">\n"
                + "          <a href=\"" + resetUrl + "\" style=\"display:inline-block;padding:14px 28px;"
                + "font-size:14.5px;font-weight:700;\n"
                + "             color:#ffffff;text-decoration:none;\">Reset password</a>\n"
                + "        </td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:20px 40px 40px;\">\n"
                + "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;\">\n"
                + "        This link expires in 30 minutes and can only be used once. Didn't request this? You "
                + "can ignore this email —\n"
                + "        your password won't change.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderEmailChangeCodeEmail(String code) {
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<meta name=\"color-scheme\" content=\"light\">\n"
                + "<meta name=\"supported-color-schemes\" content=\"light\">\n"
                + "<title>Confirm your new email</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;\">\n"
                + "<div style=\"display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;"
                + "opacity:0;overflow:hidden;\">\n"
                + "Your Extree Stats email change code: " + code + ". Expires in 10 minutes.\n"
                + "</div>\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"\n"
                + "         style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;\n"
                + "                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,"
                + "Arial,sans-serif;\n"
                + "                color:#111111;\">\n"
                + "    <tr><td style=\"padding:40px 40px 0;\">\n"
                + "      <span style=\"font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;\">"
                + "Extree</span>\n"
                + "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;"
                + "font-weight:700;\n"
                + "                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;"
                + "vertical-align:middle;\">STATS</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:22px;line-height:1.3;font-weight:600;"
                + "letter-spacing:-0.3px;\">Confirm your new email</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 0;\">\n"
                + "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">\n"
                + "        Enter this code to confirm this is your email and finish updating your Extree Stats "
                + "account.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "border=\"0\">\n"
                + "        <tr><td align=\"center\" style=\"background:#f4f5f7;border-radius:12px;"
                + "padding:28px 24px;\">\n"
                + "          <span style=\"font-family:'SF Mono','Courier New',Consolas,monospace;"
                + "font-size:36px;font-weight:600;\n"
                + "                       letter-spacing:10px;color:#111111;white-space:nowrap;\">" + code
                + "</span>\n"
                + "        </td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 40px;\">\n"
                + "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;text-align:center;\">\n"
                + "        Code expires in 10 minutes. Didn't request this? You can ignore this email.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderEmailChangeNoticeEmail(String newEmail) {
        String safeNewEmail = escapeHtml(newEmail);
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<title>Email change requested</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,"
                + "BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                + "    <tr><td style=\"padding:40px 40px 0;\">\n"
                + "      <span style=\"font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;\">"
                + "Extree</span>\n"
                + "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;"
                + "font-weight:700;\n"
                + "                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;"
                + "vertical-align:middle;\">STATS</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:22px;line-height:1.3;font-weight:600;"
                + "letter-spacing:-0.3px;\">Email change requested</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 40px;\">\n"
                + "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">\n"
                + "        Someone requested changing the email on your Extree Stats account to <strong>"
                + safeNewEmail + "</strong>.\n"
                + "        Nothing changes yet — they still need to confirm it from that inbox.\n"
                + "      </p>\n"
                + "      <p style=\"margin:16px 0 0;font-size:13px;line-height:1.6;color:#888888;\">\n"
                + "        Wasn't you? Change your password right away and contact\n"
                + "        <a href=\"mailto:support@extree.tech\" style=\"color:#ff4d5e;text-decoration:none;\">"
                + "support@extree.tech</a>.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderEmailChangedEmail(String oldEmail, String newEmail) {
        String safeOldEmail = escapeHtml(oldEmail);
        String safeNewEmail = escapeHtml(newEmail);
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<title>Your email was changed</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,"
                + "BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                + "    <tr><td style=\"padding:40px 40px 0;\">\n"
                + "      <span style=\"font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;\">"
                + "Extree</span>\n"
                + "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;"
                + "font-weight:700;\n"
                + "                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;"
                + "vertical-align:middle;\">STATS</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:22px;line-height:1.3;font-weight:600;"
                + "letter-spacing:-0.3px;\">Your email was changed</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 40px;\">\n"
                + "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">\n"
                + "        The email on your Extree Stats account was changed from <strong>" + safeOldEmail
                + "</strong> to\n"
                + "        <strong>" + safeNewEmail + "</strong>. You'll sign in with the new address from now on.\n"
                + "      </p>\n"
                + "      <p style=\"margin:16px 0 0;font-size:13px;line-height:1.6;color:#888888;\">\n"
                + "        Wasn't you? Contact <a href=\"mailto:support@extree.tech\" "
                + "style=\"color:#ff4d5e;text-decoration:none;\">support@extree.tech</a> right away.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderPasswordChangedEmail(String ip, String country, String city, String time) {
        String location = formatLocation(country, city);
        String ipText = ip != null ? ip : "unknown";
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<meta name=\"color-scheme\" content=\"light\">\n"
                + "<meta name=\"supported-color-schemes\" content=\"light\">\n"
                + "<title>Your password was changed</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;\">\n"
                + "<div style=\"display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;"
                + "opacity:0;overflow:hidden;\">\n"
                + "Your Extree Stats password was just changed from " + location + ".\n"
                + "</div>\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"\n"
                + "         style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;\n"
                + "                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,"
                + "Arial,sans-serif;\n"
                + "                color:#111111;\">\n"
                + "    <tr><td style=\"padding:40px 40px 0;\">\n"
                + "      <span style=\"font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;\">"
                + "Extree</span>\n"
                + "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;"
                + "font-weight:700;\n"
                + "                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;"
                + "vertical-align:middle;\">STATS</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:22px;line-height:1.3;font-weight:600;"
                + "letter-spacing:-0.3px;\">Your password was changed</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 0;\">\n"
                + "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">\n"
                + "        The password for your Extree Stats account was just changed. If this was you, no "
                + "action is needed.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:28px 40px 0;\">\n"
                + "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;border-radius:12px;\">\n"
                + "        <tr><td style=\"padding:18px 22px;\">\n"
                + "          <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "border=\"0\" style=\"font-size:13.5px;color:#333333;\">\n"
                + "            <tr><td style=\"padding:4px 0;color:#888888;width:84px;\">Time</td>"
                + "<td style=\"padding:4px 0;\">" + time + "</td></tr>\n"
                + "            <tr><td style=\"padding:4px 0;color:#888888;\">Location</td>"
                + "<td style=\"padding:4px 0;\">" + location + "</td></tr>\n"
                + "            <tr><td style=\"padding:4px 0;color:#888888;\">IP address</td>"
                + "<td style=\"padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;\">" + ipText
                + "</td></tr>\n"
                + "          </table>\n"
                + "        </td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:20px 40px 40px;\">\n"
                + "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;\">\n"
                + "        Didn't do this? Contact\n"
                + "        <a href=\"mailto:support@extree.tech\" style=\"color:#ff4d5e;text-decoration:none;\">"
                + "support@extree.tech</a>\n"
                + "        right away.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderSignInNotificationEmail(String ip, String country, String city, String time) {
        String location = formatLocation(country, city);
        String ipText = ip != null ? ip : "unknown";
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<meta name=\"color-scheme\" content=\"light\">\n"
                + "<meta name=\"supported-color-schemes\" content=\"light\">\n"
                + "<title>New sign-in to your account</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;\">\n"
                + "<div style=\"display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;"
                + "opacity:0;overflow:hidden;\">\n"
                + "New sign-in to your Extree Stats account from " + location + ".\n"
                + "</div>\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"\n"
                + "         style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;\n"
                + "                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,"
                + "Arial,sans-serif;\n"
                + "                color:#111111;\">\n"
                + "    <tr><td style=\"padding:40px 40px 0;\">\n"
                + "      <span style=\"font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;\">"
                + "Extree</span>\n"
                + "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;"
                + "font-weight:700;\n"
                + "                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;"
                + "vertical-align:middle;\">STATS</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:22px;line-height:1.3;font-weight:600;"
                + "letter-spacing:-0.3px;\">New sign-in to your account</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 0;\">\n"
                + "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">\n"
                + "        Your Extree Stats account was just signed in to. If this was you, no action is needed.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:28px 40px 0;\">\n"
                + "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;border-radius:12px;\">\n"
                + "        <tr><td style=\"padding:18px 22px;\">\n"
                + "          <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "border=\"0\" style=\"font-size:13.5px;color:#333333;\">\n"
                + "            <tr><td style=\"padding:4px 0;color:#888888;width:84px;\">Time</td>"
                + "<td style=\"padding:4px 0;\">" + time + "</td></tr>\n"
                + "            <tr><td style=\"padding:4px 0;color:#888888;\">Location</td>"
                + "<td style=\"padding:4px 0;\">" + location + "</td></tr>\n"
                + "            <tr><td style=\"padding:4px 0;color:#888888;\">IP address</td>"
                + "<td style=\"padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;\">" + ipText
                + "</td></tr>\n"
                + "          </table>\n"
                + "        </td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:20px 40px 40px;\">\n"
                + "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;\">\n"
                + "        Don't recognize this? Change your Extree Stats password and contact\n"
                + "        <a href=\"mailto:support@extree.tech\" style=\"color:#ff4d5e;text-decoration:none;\">"
                + "support@extree.tech</a>.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderNewLocationCodeEmail(String code, String ip, String country, String city) {
        String location = formatLocation(country, city);
        String ipText = ip != null ? ip : "unknown";
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<meta name=\"color-scheme\" content=\"light\">\n"
                + "<meta name=\"supported-color-schemes\" content=\"light\">\n"
                + "<title>Confirm this sign-in</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;\">\n"
                + "<div style=\"display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;"
                + "opacity:0;overflow:hidden;\">\n"
                + "Your Extree Stats sign-in code: " + code + ". A sign-in attempt came from " + location + ".\n"
                + "</div>\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"\n"
                + "         style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;\n"
                + "                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,"
                + "Arial,sans-serif;\n"
                + "                color:#111111;\">\n"
                + "    <tr><td style=\"padding:40px 40px 0;\">\n"
                + "      <span style=\"font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;\">"
                + "Extree</span>\n"
                + "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;"
                + "font-weight:700;\n"
                + "                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;"
                + "vertical-align:middle;\">STATS</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:22px;line-height:1.3;font-weight:600;"
                + "letter-spacing:-0.3px;\">Confirm this sign-in</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 0;\">\n"
                + "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">\n"
                + "        Someone just tried to sign in to your Extree Stats account from <strong>" + location
                + "</strong>\n"
                + "        (IP " + ipText + ") — a place we haven't seen before. If this was you, enter the code "
                + "below to continue.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "border=\"0\">\n"
                + "        <tr><td align=\"center\" style=\"background:#f4f5f7;border-radius:12px;"
                + "padding:28px 24px;\">\n"
                + "          <span style=\"font-family:'SF Mono','Courier New',Consolas,monospace;"
                + "font-size:36px;font-weight:600;\n"
                + "                       letter-spacing:10px;color:#111111;white-space:nowrap;\">" + code
                + "</span>\n"
                + "        </td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 40px;\">\n"
                + "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;text-align:center;\">\n"
                + "        Code expires in 10 minutes. Wasn't you? Change your password and contact\n"
                + "        <a href=\"mailto:support@extree.tech\" style=\"color:#ff4d5e;text-decoration:none;\">"
                + "support@extree.tech</a>.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }

    private static String renderVerificationEmail(String code) {
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<meta name=\"color-scheme\" content=\"light\">\n"
                + "<meta name=\"supported-color-schemes\" content=\"light\">\n"
                + "<title>Verify your email</title>\n"
                + "</head>\n"
                + "<body style=\"margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;\">\n"
                + "<div style=\"display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;"
                + "max-width:0;opacity:0;overflow:hidden;\">\n"
                + "Your Extree Stats verification code: " + code + ". Expires in 10 minutes.\n"
                + "</div>\n"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                + "style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                + "<tr><td align=\"center\">\n"
                + "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"\n"
                + "         style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;\n"
                + "                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,"
                + "Arial,sans-serif;\n"
                + "                color:#111111;\">\n"
                + "    <tr><td style=\"padding:40px 40px 0;\">\n"
                + "      <span style=\"font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;\">"
                + "Extree</span>\n"
                + "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;"
                + "font-weight:700;\n"
                + "                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;"
                + "vertical-align:middle;\">STATS</span>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <h1 style=\"margin:0;font-size:22px;line-height:1.3;font-weight:600;"
                + "letter-spacing:-0.3px;\">Verify your email</h1>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 0;\">\n"
                + "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">\n"
                + "        Enter this code to confirm your email and finish creating your Extree Stats "
                + "account.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:32px 40px 0;\">\n"
                + "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "border=\"0\">\n"
                + "        <tr><td align=\"center\" style=\"background:#f4f5f7;border-radius:12px;"
                + "padding:28px 24px;\">\n"
                + "          <span style=\"font-family:'SF Mono','Courier New',Consolas,monospace;"
                + "font-size:36px;font-weight:600;\n"
                + "                       letter-spacing:10px;color:#111111;white-space:nowrap;\">" + code
                + "</span>\n"
                + "        </td></tr>\n"
                + "      </table>\n"
                + "    </td></tr>\n"
                + "    <tr><td style=\"padding:16px 40px 40px;\">\n"
                + "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;text-align:center;\">\n"
                + "        Code expires in 10 minutes. Didn't request this? You can ignore this email.\n"
                + "      </p>\n"
                + "    </td></tr>\n"
                + "  </table>\n"
                + "</td></tr>\n"
                + "</table>\n"
                + "</body>\n"
                + "</html>";
    }
}