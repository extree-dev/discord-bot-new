package tech.extree.stats.adapter.out.mail;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.Mailer;

/**
 * Зеркалит sendVerificationCode/renderVerificationEmail из
 * ../../stats-backend/mailer.js письмо в письмо — тот же HTML, тема,
 * отправитель. SMTP-транспорт (smtp.mail.me.com, 587/STARTTLS)
 * настроен через spring.mail в application.yml, а не здесь — тот же
 * .env (STATS_MAIL_USER/STATS_MAIL_APP_PASSWORD), что у Node-сервиса.
 */
@Component
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
