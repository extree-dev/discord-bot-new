package tech.extree.stats.application.port.out;

/**
 * Выходной порт для хеширования/проверки паролей. Реализация
 * (adapter/out/crypto/ScryptPasswordHasher) должна быть байт-совместима
 * с ../../stats-backend/users.js — существующие пароли уже захешированы
 * Node'овым crypto.scryptSync, переподключить их на другую схему хеша
 * значило бы разом сбросить пароль каждому аккаунту.
 */
public interface PasswordHasher {
    String hash(String password);

    boolean verify(String password, String stored);
}
