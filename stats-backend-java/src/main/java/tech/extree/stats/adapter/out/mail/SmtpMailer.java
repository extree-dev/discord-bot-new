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
    }

    @Override
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
    }

    @Override
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
    }

    @Override
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
    }

    @Override
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
    }

    @Override
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
    }

    @Override
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

    // Как и formatLocation в mailer.js (Node) — city здесь всегда null
    // (см. IpCountryGeoLookup), поэтому письма от этого сервиса всегда
    // попадают в ветку "страна без города", что уже штатно поддерживается.
    private static String formatLocation(String country, String city) {
        if (country == null) {
            return "an unknown location";
        }
        return city != null ? city + ", " + country : country;
    }

    // Экранирование HTML-спецсимволов — та же escapeHtml, что в mailer.js
    // (Node), нужна именно тут: newEmail/oldEmail ниже это значения email
    // аккаунта (пользовательский ввод при регистрации/смене), в отличие от
    // geo/code/ip, которые сервис генерирует/вычисляет сам.
    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
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

    // Интерполяция без экранирования — так же, как в mailer.js: ip/location/
    // code/time тут не сырой пользовательский ввод (геолокация и
    // сгенерированный код), тот же уровень доверия, что у Node-оригинала.
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
