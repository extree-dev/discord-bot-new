package tech.extree.stats.application.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tech.extree.stats.adapter.out.crypto.AesGcmSessionCodec;
import tech.extree.stats.domain.Session;

/**
 * Пре-2FA cookie: после успешной проверки пароля (но до ввода TOTP-кода)
 * выдаём короткоживущий токен (5 минут), который хранит userId+rememberMe.
 * После ввода кода — обмениваем на полноценную cookie.
 *
 * Формат — тот же AES-GCM, что у SessionCodec, только payload другой.
 * Используем AesGcmSessionCodec под капотом, но с Session-объектом, где
 * sub = "pre2fa:<rememberMe>" — чтобы отличать от настоящей сессии.
 */
@Service
public class Pre2faService {

    private static final Duration TTL = Duration.ofMinutes(5);
    private static final String SUB_PREFIX = "pre2fa:";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AesGcmSessionCodec codec;

    public Pre2faService(AesGcmSessionCodec codec) {
        this.codec = codec;
    }

    public record Pre2faPayload(String userId, boolean rememberMe, Instant issuedAt) {}

    public String encode(String userId, boolean rememberMe) {
        Session s = new Session(SUB_PREFIX + rememberMe, userId, System.currentTimeMillis());
        return codec.encrypt(s);
    }

    public Optional<Pre2faPayload> decode(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        Optional<Session> session = codec.decrypt(token);
        if (session.isEmpty()) return Optional.empty();
        Session s = session.get();
        if (s.sub() == null || !s.sub().startsWith(SUB_PREFIX)) return Optional.empty();
        long ageMs = System.currentTimeMillis() - s.issuedAt();
        if (ageMs > TTL.toMillis() || ageMs < 0) return Optional.empty();
        boolean remember = Boolean.parseBoolean(s.sub().substring(SUB_PREFIX.length()));
        return Optional.of(new Pre2faPayload(s.userId(), remember, Instant.ofEpochMilli(s.issuedAt())));
    }
}