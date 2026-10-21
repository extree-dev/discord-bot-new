package tech.extree.stats.application.port.out;

/** Соответствует части mailer.js (Node), перенесённой в этой фазе. */
public interface Mailer {
    void sendVerificationCode(String email, String code);

    void sendNewLocationCode(String email, String code, String ip, String country, String city);

    void sendSignInNotification(String email, String ip, String country, String city, String time);
}
