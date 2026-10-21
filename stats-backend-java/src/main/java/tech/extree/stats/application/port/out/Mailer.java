package tech.extree.stats.application.port.out;

/** Соответствует части mailer.js (Node), перенесённой в этой фазе. */
public interface Mailer {
    void sendVerificationCode(String email, String code);
}
