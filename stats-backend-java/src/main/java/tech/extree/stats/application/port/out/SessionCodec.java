package tech.extree.stats.application.port.out;

import java.util.Optional;
import tech.extree.stats.domain.Session;

/**
 * Выходной порт для расшифровки сессионной cookie. Реализация
 * (adapter/out/crypto/AesGcmSessionCodec) должна быть бинарно совместима
 * с ../../stats-backend/session.js — те же токены, которые уже выдал
 * Node-сервис, должны расшифровываться и здесь, иначе переключение
 * части трафика на этот сервис разлогинит всех пользователей.
 */
public interface SessionCodec {
    /** Пустой Optional на любую проблему (битая/подделанная cookie) — как decryptSession в Node, не выбрасывает. */
    Optional<Session> decrypt(String token);
}
