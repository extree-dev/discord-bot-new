package tech.extree.stats.application.port.out;

/** Соответствует части mailer.js (Node), перенесённой в этой фазе. */
public interface Mailer {
    void sendVerificationCode(String email, String code);

    void sendNewLocationCode(String email, String code, String ip, String country, String city);

    void sendSignInNotification(String email, String ip, String country, String city, String time);

    void sendPasswordResetEmail(String email, String resetUrl);

    void sendEmailChangeCode(String newEmail, String code);

    void sendEmailChangeNotice(String oldEmail, String newEmail);

    void sendEmailChanged(String to, String oldEmail, String newEmail);

    void sendPasswordChanged(String email, String ip, String country, String city, String time);

    void sendSupportTicketConfirmation(String email, long ticketNumber, String subject, String ticketUrl);

    void sendSupportTicketNotification(
            long ticketNumber, String email, String subject, String message, String category, String userId, String adminUrl);

    void sendSupportTicketReply(String email, long ticketNumber, String subject, String message, String adminName, String ticketUrl);

    void sendSupportTicketUserReply(long ticketNumber, String email, String subject, String message, String adminUrl);
}
