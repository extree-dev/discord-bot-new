package tech.extree.stats.adapter.out.mail;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.Mailer;

import java.util.Map;

/**
 * Отправка писем через HTTP API Resend (порт 443), чтобы обойти блокировку
 * SMTP.
 */
@Component
@Profile("!dev")
public class ResendMailer implements Mailer {

    private final Resend resend;
    private final String fromAddress;

    public ResendMailer(
            @Value("${RESEND_API_KEY:}") String apiKey,
            @Value("${extree.mail-from:}") String configuredFrom) {
        this.resend = new Resend(apiKey);
        this.fromAddress = (configuredFrom == null || configuredFrom.isBlank())
                ? "Extree Stats <noreply@extree.tech>"
                : configuredFrom;
    }

    private void send(String to, String subject, String html) {
        try {
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromAddress)
                    .to(to)
                    .subject(subject)
                    .html(html)
                    .build();
            resend.emails().send(params);
        } catch (ResendException e) {
            throw new IllegalStateException("Ошибка отправки через Resend API: " + e.getMessage(), e);
        }
    }

    @Override
    public void sendVerificationCode(String email, String code) {
        send(email, "Verify your email — Extree Stats", renderVerificationEmail(code));
    }

    @Override
    public void sendNewLocationCode(String email, String code, String ip, String country, String city) {
        send(email, "Confirm this sign-in — Extree Stats", renderNewLocationCodeEmail(code, ip, country, city));
    }

    @Override
    public void sendSignInNotification(String email, String ip, String country, String city, String time) {
        send(email, "New sign-in to your account — Extree Stats",
                renderSignInNotificationEmail(ip, country, city, time));
    }

    @Override
    public void sendPasswordResetEmail(String email, String resetUrl) {
        send(email, "Reset your password — Extree Stats", renderPasswordResetEmail(resetUrl));
    }

    @Override
    public void sendEmailChangeCode(String newEmail, String code) {
        send(newEmail, "Confirm your new email — Extree Stats", renderEmailChangeCodeEmail(code));
    }

    @Override
    public void sendEmailChangeNotice(String oldEmail, String newEmail) {
        send(oldEmail, "Email change requested — Extree Stats", renderEmailChangeNoticeEmail(newEmail));
    }

    @Override
    public void sendEmailChanged(String to, String oldEmail, String newEmail) {
        send(to, "Your email was changed — Extree Stats", renderEmailChangedEmail(oldEmail, newEmail));
    }

    @Override
    public void sendPasswordChanged(String email, String ip, String country, String city, String time) {
        send(email, "Your password was changed — Extree Stats", renderPasswordChangedEmail(ip, country, city, time));
    }

    @Override
    public void sendSupportTicketConfirmation(String email, long ticketNumber, String subject, String ticketUrl) {
        send(email, "We got your request — Extree Stats #" + ticketNumber,
                renderSupportTicketConfirmationEmail(ticketNumber, subject, ticketUrl));
    }

    @Override
    public void sendSupportTicketNotification(long ticketNumber, String email, String subject, String message,
            String category, String userId, String adminUrl) {
        send("support@extree.tech", "[Ticket #" + ticketNumber + "] " + subject, renderSupportTicketNotificationEmail(
                ticketNumber, email, subject, message, category, userId, adminUrl));
    }

    @Override
    public void sendSupportTicketReply(String email, long ticketNumber, String subject, String message,
            String adminName, String ticketUrl) {
        send(email, "Re: " + subject + " — Extree Stats #" + ticketNumber,
                renderSupportTicketReplyEmail(ticketNumber, message, adminName, ticketUrl));
    }

    @Override
    public void sendSupportTicketUserReply(long ticketNumber, String email, String subject, String message,
            String adminUrl) {
        send("support@extree.tech", "Re: [Ticket #" + ticketNumber + "] " + subject,
                renderSupportTicketUserReplyEmail(ticketNumber, email, subject, message, adminUrl));
    }

    // --- HTML ШАБЛОНЫ (скопированы из SmtpMailer) ---

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private static final Map<String, String> SUPPORT_CATEGORY_LABELS = Map.of("account", "Account & login", "bug",
            "Bug report", "billing", "Billing", "other", "Other");

    private static String renderVerificationEmail(String code) {
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>Verify your email</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:40px 40px 0;\">\n" +
                "      <span style=\"font-size:16px;font-weight:700;color:#111111;\">Extree</span>\n" +
                "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;margin-left:8px;\">STATS</span>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:22px;font-weight:600;\">Verify your email</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 0;\">\n" +
                "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">Enter this code to confirm your email and finish creating your Extree Stats account.</p>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n"
                +
                "        <tr><td align=\"center\" style=\"background:#f4f5f7;border-radius:12px;padding:28px 24px;\">\n"
                +
                "          <span style=\"font-family:'SF Mono','Courier New',Consolas,monospace;font-size:36px;font-weight:600;letter-spacing:10px;color:#111111;\">"
                + code + "</span>\n" +
                "        </td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 40px;\">\n" +
                "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;text-align:center;\">Code expires in 10 minutes. Didn't request this? You can ignore this email.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderNewLocationCodeEmail(String code, String ip, String country, String city) {
        String location = (country == null) ? "an unknown location" : (city != null ? city + ", " + country : country);
        String ipText = ip != null ? ip : "unknown";
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>Confirm this sign-in</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:40px 40px 0;\">\n" +
                "      <span style=\"font-size:16px;font-weight:700;color:#111111;\">Extree</span>\n" +
                "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;margin-left:8px;\">STATS</span>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:22px;font-weight:600;\">Confirm this sign-in</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 0;\">\n" +
                "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">Someone just tried to sign in to your Extree Stats account from <strong>"
                + location + "</strong> (IP " + ipText
                + ") — a place we haven't seen before. If this was you, enter the code below to continue.</p>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n"
                +
                "        <tr><td align=\"center\" style=\"background:#f4f5f7;border-radius:12px;padding:28px 24px;\">\n"
                +
                "          <span style=\"font-family:'SF Mono','Courier New',Consolas,monospace;font-size:36px;font-weight:600;letter-spacing:10px;color:#111111;\">"
                + code + "</span>\n" +
                "        </td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 40px;\">\n" +
                "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;text-align:center;\">Code expires in 10 minutes. Wasn't you? Change your password and contact support@extree.tech.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderSignInNotificationEmail(String ip, String country, String city, String time) {
        String location = (country == null) ? "an unknown location" : (city != null ? city + ", " + country : country);
        String ipText = ip != null ? ip : "unknown";
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>New sign-in to your account</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:40px 40px 0;\">\n" +
                "      <span style=\"font-size:16px;font-weight:700;color:#111111;\">Extree</span>\n" +
                "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;margin-left:8px;\">STATS</span>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:22px;font-weight:600;\">New sign-in to your account</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 0;\">\n" +
                "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">Your Extree Stats account was just signed in to. If this was you, no action is needed.</p>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:28px 40px 0;\">\n" +
                "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;border-radius:12px;\">\n"
                +
                "        <tr><td style=\"padding:18px 22px;\">\n" +
                "          <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"font-size:13.5px;color:#333333;\">\n"
                +
                "            <tr><td style=\"padding:4px 0;color:#888888;width:84px;\">Time</td><td style=\"padding:4px 0;\">"
                + time + "</td></tr>\n" +
                "            <tr><td style=\"padding:4px 0;color:#888888;\">Location</td><td style=\"padding:4px 0;\">"
                + location + "</td></tr>\n" +
                "            <tr><td style=\"padding:4px 0;color:#888888;\">IP address</td><td style=\"padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;\">"
                + ipText + "</td></tr>\n" +
                "          </table>\n" +
                "        </td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:20px 40px 40px;\">\n" +
                "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;\">Don't recognize this? Change your Extree Stats password and contact support@extree.tech.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderPasswordResetEmail(String resetUrl) {
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>Reset your password</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:40px 40px 0;\">\n" +
                "      <span style=\"font-size:16px;font-weight:700;color:#111111;\">Extree</span>\n" +
                "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;margin-left:8px;\">STATS</span>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:22px;font-weight:600;\">Reset your password</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 0;\">\n" +
                "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">We got a request to reset the password for your Extree Stats account. Click the button below to choose a new one.</p>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:28px 40px 0;\">\n" +
                "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n" +
                "        <tr><td style=\"background:#ff4d5e;border-radius:10px;\">\n" +
                "          <a href=\"" + resetUrl
                + "\" style=\"display:inline-block;padding:14px 28px;font-size:14.5px;font-weight:700;color:#ffffff;text-decoration:none;\">Reset password</a>\n"
                +
                "        </td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:20px 40px 40px;\">\n" +
                "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;\">This link expires in 30 minutes and can only be used once. Didn't request this? You can ignore this email — your password won't change.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderEmailChangeCodeEmail(String code) {
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>Confirm your new email</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:40px 40px 0;\">\n" +
                "      <span style=\"font-size:16px;font-weight:700;color:#111111;\">Extree</span>\n" +
                "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;margin-left:8px;\">STATS</span>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:22px;font-weight:600;\">Confirm your new email</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 0;\">\n" +
                "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">Enter this code to confirm this is your email and finish updating your Extree Stats account.</p>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n"
                +
                "        <tr><td align=\"center\" style=\"background:#f4f5f7;border-radius:12px;padding:28px 24px;\">\n"
                +
                "          <span style=\"font-family:'SF Mono','Courier New',Consolas,monospace;font-size:36px;font-weight:600;letter-spacing:10px;color:#111111;\">"
                + code + "</span>\n" +
                "        </td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 40px;\">\n" +
                "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;text-align:center;\">Code expires in 10 minutes. Didn't request this? You can ignore this email.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderEmailChangeNoticeEmail(String newEmail) {
        String safeNewEmail = escapeHtml(newEmail);
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>Email change requested</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:40px 40px 0;\">\n" +
                "      <span style=\"font-size:16px;font-weight:700;color:#111111;\">Extree</span>\n" +
                "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;margin-left:8px;\">STATS</span>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:22px;font-weight:600;\">Email change requested</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 40px;\">\n" +
                "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">Someone requested changing the email on your Extree Stats account to <strong>"
                + safeNewEmail + "</strong>. Nothing changes yet — they still need to confirm it from that inbox.</p>\n"
                +
                "      <p style=\"margin:16px 0 0;font-size:13px;line-height:1.6;color:#888888;\">Wasn't you? Change your password right away and contact support@extree.tech.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderEmailChangedEmail(String oldEmail, String newEmail) {
        String safeOldEmail = escapeHtml(oldEmail);
        String safeNewEmail = escapeHtml(newEmail);
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>Your email was changed</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:40px 40px 0;\">\n" +
                "      <span style=\"font-size:16px;font-weight:700;color:#111111;\">Extree</span>\n" +
                "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;margin-left:8px;\">STATS</span>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:22px;font-weight:600;\">Your email was changed</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 40px;\">\n" +
                "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">The email on your Extree Stats account was changed from <strong>"
                + safeOldEmail + "</strong> to <strong>" + safeNewEmail
                + "</strong>. You'll sign in with the new address from now on.</p>\n" +
                "      <p style=\"margin:16px 0 0;font-size:13px;line-height:1.6;color:#888888;\">Wasn't you? Contact support@extree.tech right away.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderPasswordChangedEmail(String ip, String country, String city, String time) {
        String location = (country == null) ? "an unknown location" : (city != null ? city + ", " + country : country);
        String ipText = ip != null ? ip : "unknown";
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>Your password was changed</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:48px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:40px 40px 0;\">\n" +
                "      <span style=\"font-size:16px;font-weight:700;color:#111111;\">Extree</span>\n" +
                "      <span style=\"display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;margin-left:8px;\">STATS</span>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:32px 40px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:22px;font-weight:600;\">Your password was changed</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 40px 0;\">\n" +
                "      <p style=\"margin:0;font-size:15px;line-height:1.6;color:#555555;\">The password for your Extree Stats account was just changed. If this was you, no action is needed.</p>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:28px 40px 0;\">\n" +
                "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;border-radius:12px;\">\n"
                +
                "        <tr><td style=\"padding:18px 22px;\">\n" +
                "          <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"font-size:13.5px;color:#333333;\">\n"
                +
                "            <tr><td style=\"padding:4px 0;color:#888888;width:84px;\">Time</td><td style=\"padding:4px 0;\">"
                + time + "</td></tr>\n" +
                "            <tr><td style=\"padding:4px 0;color:#888888;\">Location</td><td style=\"padding:4px 0;\">"
                + location + "</td></tr>\n" +
                "            <tr><td style=\"padding:4px 0;color:#888888;\">IP address</td><td style=\"padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;\">"
                + ipText + "</td></tr>\n" +
                "          </table>\n" +
                "        </td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:20px 40px 40px;\">\n" +
                "      <p style=\"margin:0;font-size:13px;line-height:1.6;color:#888888;\">Didn't do this? Contact support@extree.tech right away.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderSupportTicketConfirmationEmail(long ticketNumber, String subject, String ticketUrl) {
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>We got your request</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#ffffff;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:580px;width:100%;color:#1a1a1a;padding:32px 24px;\">\n"
                +
                "    <tr><td style=\"padding-bottom:24px;font-size:12.5px;color:#888888;\">Extree Stats Support</td></tr>\n"
                +
                "    <tr><td style=\"font-size:15px;line-height:1.7;\">\n" +
                "      Hi there,<br><br>\n" +
                "      Thanks for reaching out — we got your message (<strong>" + escapeHtml(subject)
                + "</strong>) and will reply as soon as we can.\n" +
                "      <br><br>\n" +
                "      You can view it, and reply whenever you want, here: <a href=\"" + ticketUrl
                + "\" style=\"color:#ff4d5e;\">" + ticketUrl + "</a>.\n" +
                "      We'll also email you the moment we reply.\n" +
                "      <br><br>\n" +
                "      Best regards,<br>Extree Stats Support\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding-top:32px;\">\n" +
                "      <hr style=\"border:none;border-top:1px solid #e5e5e5;margin:0 0 16px;\">\n" +
                "      <p style=\"margin:0;font-size:12.5px;line-height:1.6;color:#999999;\">Ticket #"
                + escapeHtml(String.valueOf(ticketNumber))
                + ". Didn't send this request? Contact <a href=\"mailto:support@extree.tech\" style=\"color:#999999;\">support@extree.tech</a>.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderSupportTicketNotificationEmail(long ticketNumber, String email, String subject,
            String message, String category, String userId, String adminUrl) {
        String categoryLabel = SUPPORT_CATEGORY_LABELS.getOrDefault(category, "Other");
        String fromLine = escapeHtml(email) + (userId != null ? " (signed in)" : " (not signed in)");
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>New support ticket</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:32px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;width:100%;background:#ffffff;border-radius:12px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:28px 32px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:18px;font-weight:700;\">New Extree Stats support ticket</h1>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 32px 0;\">\n" +
                "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"font-size:13.5px;color:#333333;\">\n"
                +
                "        <tr><td style=\"padding:4px 0;color:#888888;width:84px;\">Ticket</td><td style=\"padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;\">#"
                + escapeHtml(String.valueOf(ticketNumber)) + "</td></tr>\n" +
                "        <tr><td style=\"padding:4px 0;color:#888888;\">From</td><td style=\"padding:4px 0;\">"
                + fromLine + "</td></tr>\n" +
                "        <tr><td style=\"padding:4px 0;color:#888888;\">Category</td><td style=\"padding:4px 0;\">"
                + escapeHtml(categoryLabel) + "</td></tr>\n" +
                "        <tr><td style=\"padding:4px 0;color:#888888;\">Subject</td><td style=\"padding:4px 0;\">"
                + escapeHtml(subject) + "</td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:20px 32px 0;\">\n" +
                "      <p style=\"margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#888888;\">Message</p>\n"
                +
                "      <p style=\"margin:0;font-size:14px;line-height:1.6;color:#111111;white-space:pre-wrap;\">"
                + escapeHtml(message) + "</p>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:24px 32px 28px;\">\n" +
                "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n" +
                "        <tr><td style=\"background:#ff4d5e;border-radius:10px;\">\n" +
                "          <a href=\"" + adminUrl
                + "\" style=\"display:inline-block;padding:12px 24px;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;\">Reply in admin</a>\n"
                +
                "        </td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderSupportTicketReplyEmail(long ticketNumber, String message, String adminName,
            String ticketUrl) {
        String safeAdminName = escapeHtml(adminName);
        String ticketLabel = escapeHtml(String.valueOf(ticketNumber));
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>New reply to your ticket</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#ffffff;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:580px;width:100%;color:#1a1a1a;padding:32px 24px;\">\n"
                +
                "    <tr><td style=\"padding-bottom:24px;\">\n" +
                "      <span style=\"font-size:14px;font-weight:700;\">" + safeAdminName + "</span>\n" +
                "      <span style=\"font-size:12.5px;color:#888888;\"> (Extree Stats Support)</span>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"font-size:15px;line-height:1.7;white-space:pre-wrap;\">" + escapeHtml(message)
                + "</td></tr>\n" +
                "    <tr><td style=\"padding-top:24px;font-size:15px;line-height:1.7;\">\n" +
                "      Best regards,<br>" + safeAdminName + "<br>Extree Stats Support\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding-top:32px;\">\n" +
                "      <hr style=\"border:none;border-top:1px solid #e5e5e5;margin:0 0 16px;\">\n" +
                "      <p style=\"margin:0;font-size:12.5px;line-height:1.6;color:#999999;\">Reply on ticket #"
                + ticketLabel + ": <a href=\"" + ticketUrl + "\" style=\"color:#999999;\">" + ticketUrl + "</a>.</p>\n"
                +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }

    private static String renderSupportTicketUserReplyEmail(long ticketNumber, String email, String subject,
            String message, String adminUrl) {
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "<title>New reply on a support ticket</title>\n" +
                "</head>\n" +
                "<body style=\"margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">\n"
                +
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:32px 16px;\">\n"
                +
                "<tr><td align=\"center\">\n" +
                "  <table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;width:100%;background:#ffffff;border-radius:12px;color:#111111;\">\n"
                +
                "    <tr><td style=\"padding:28px 32px 0;\">\n" +
                "      <h1 style=\"margin:0;font-size:18px;font-weight:700;\">New reply on an Extree Stats ticket</h1>\n"
                +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:16px 32px 0;\">\n" +
                "      <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"font-size:13.5px;color:#333333;\">\n"
                +
                "        <tr><td style=\"padding:4px 0;color:#888888;width:84px;\">Ticket</td><td style=\"padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;\">#"
                + escapeHtml(String.valueOf(ticketNumber)) + "</td></tr>\n" +
                "        <tr><td style=\"padding:4px 0;color:#888888;\">From</td><td style=\"padding:4px 0;\">"
                + escapeHtml(email) + "</td></tr>\n" +
                "        <tr><td style=\"padding:4px 0;color:#888888;\">Subject</td><td style=\"padding:4px 0;\">"
                + escapeHtml(subject) + "</td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:20px 32px 0;\">\n" +
                "      <p style=\"margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#888888;\">Reply</p>\n"
                +
                "      <p style=\"margin:0;font-size:14px;line-height:1.6;color:#111111;white-space:pre-wrap;\">"
                + escapeHtml(message) + "</p>\n" +
                "    </td></tr>\n" +
                "    <tr><td style=\"padding:24px 32px 28px;\">\n" +
                "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n" +
                "        <tr><td style=\"background:#ff4d5e;border-radius:10px;\">\n" +
                "          <a href=\"" + adminUrl
                + "\" style=\"display:inline-block;padding:12px 24px;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;\">Reply in admin</a>\n"
                +
                "        </td></tr>\n" +
                "      </table>\n" +
                "    </td></tr>\n" +
                "  </table>\n" +
                "</td></tr>\n" +
                "</table>\n" +
                "</body>\n" +
                "</html>";
    }
}