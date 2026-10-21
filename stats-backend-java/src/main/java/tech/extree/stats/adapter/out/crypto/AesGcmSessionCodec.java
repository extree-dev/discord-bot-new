package tech.extree.stats.adapter.out.crypto;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.domain.Session;

/**
 * Байт-в-байт совместим с ../../stats-backend/session.js: ключ —
 * SHA-256(secret), AES-256-GCM, 12-байтный IV, 16-байтный auth tag,
 * cookie = base64url(iv || tag || ciphertext). Единственная тонкость —
 * Node кладёт tag СРАЗУ ПОСЛЕ iv, перед шифротекстом (cipher.getAuthTag()
 * вызывается отдельно и приклеивается руками), а javax.crypto ожидает tag
 * в КОНЦЕ входных данных (стандартное поведение GCM-реализации JDK) —
 * поэтому при расшифровке здесь входной буфer пересобирается в
 * ciphertext || tag перед Cipher.doFinal, см. decrypt() ниже. Без этой
 * перестановки токены, выпущенные Node, не читались бы здесь вообще, и
 * постепенный перевод трафика на этот сервис разлогинил бы всех сразу.
 */
@Component
public class AesGcmSessionCodec implements SessionCodec {

    private static final String CIPHER_ALGO = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BYTES = 16;
    private static final int TAG_LENGTH_BITS = TAG_LENGTH_BYTES * 8;

    private final byte[] key;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();

    public AesGcmSessionCodec(@Value("${extree.session-secret}") String secret) {
        this.key = deriveKey(secret);
    }

    private static byte[] deriveKey(String secret) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            return sha256.digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось вычислить SHA-256 для STATS_SESSION_SECRET", e);
        }
    }

    @Override
    public Optional<Session> decrypt(String token) {
        try {
            byte[] raw = Base64.getUrlDecoder().decode(token);
            if (raw.length < IV_LENGTH + TAG_LENGTH_BYTES) {
                return Optional.empty();
            }
            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(raw, 0, iv, 0, IV_LENGTH);
            byte[] tag = new byte[TAG_LENGTH_BYTES];
            System.arraycopy(raw, IV_LENGTH, tag, 0, TAG_LENGTH_BYTES);
            int ciphertextLength = raw.length - IV_LENGTH - TAG_LENGTH_BYTES;
            // javax.crypto хочет tag в конце — пересобираем порядок,
            // в котором Node хранит их в cookie (iv, tag, ciphertext).
            byte[] ciphertextWithTag = new byte[ciphertextLength + TAG_LENGTH_BYTES];
            System.arraycopy(raw, IV_LENGTH + TAG_LENGTH_BYTES, ciphertextWithTag, 0, ciphertextLength);
            System.arraycopy(tag, 0, ciphertextWithTag, ciphertextLength, TAG_LENGTH_BYTES);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] plaintext = cipher.doFinal(ciphertextWithTag);

            Map<String, Object> payload = objectMapper.readValue(plaintext, Map.class);
            String sub = (String) payload.get("sub");
            String userId = (String) payload.get("userId");
            Number issuedAt = (Number) payload.get("issuedAt");
            return Optional.of(new Session(sub, userId, issuedAt != null ? issuedAt.longValue() : 0L));
        } catch (Exception e) {
            // Битая/подделанная/чужим ключом подписанная cookie — то же
            // поведение, что decryptSession в Node: null/пусто, не исключение.
            return Optional.empty();
        }
    }

    @Override
    public String encrypt(Session session) {
        try {
            // LinkedHashMap + явный пропуск null-полей — то же, что
            // JSON.stringify делает с undefined-ключами в Node (опускает
            // их, не пишет null), важно для места под байт в байт.
            Map<String, Object> payload = new LinkedHashMap<>();
            if (session.sub() != null) {
                payload.put("sub", session.sub());
            }
            if (session.userId() != null) {
                payload.put("userId", session.userId());
            }
            payload.put("issuedAt", session.issuedAt());
            byte[] plaintext = objectMapper.writeValueAsBytes(payload);

            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertextWithTag = cipher.doFinal(plaintext);
            int ciphertextLength = ciphertextWithTag.length - TAG_LENGTH_BYTES;

            // Node кладёt tag сразу после iv, перед шифротекстом — тот же
            // порядок, что decrypt() выше ожидает при чтении.
            byte[] out = new byte[IV_LENGTH + TAG_LENGTH_BYTES + ciphertextLength];
            System.arraycopy(iv, 0, out, 0, IV_LENGTH);
            System.arraycopy(ciphertextWithTag, ciphertextLength, out, IV_LENGTH, TAG_LENGTH_BYTES);
            System.arraycopy(ciphertextWithTag, 0, out, IV_LENGTH + TAG_LENGTH_BYTES, ciphertextLength);

            return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось зашифровать сессию", e);
        }
    }
}
