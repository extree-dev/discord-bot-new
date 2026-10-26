package tech.extree.stats.adapter.out.crypto;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.TotpSecretCodec;

/**
 * Колонка stats_user_totp_secrets.secret_encrypted называлась так с самого
 * начала, но до этого фикса секрет писался туда как обычный текст — любой,
 * кто прочитал бы базу, мог сгенерировать валидные коды 2FA для любого
 * аккаунта. Здесь — реальное шифрование: AES-256-GCM, ключ —
 * SHA-256("totp:" + STATS_SESSION_SECRET), отдельно от ключа сессионных
 * cookie (AesGcmSessionCodec), чтобы один и тот же ключевой материал не
 * использовался для двух разных целей. Формат: "v1:" + base64url(iv(12) ||
 * tag(16) || ciphertext).
 *
 * decrypt() значения без префикса "v1:" (или которое не расшифровывается
 * этим ключом) возвращает как есть — это старая запись с секретом в чистом
 * виде, сделанная до фикса. Так уже включённая у пользователей 2FA не
 * ломается; следующий upsertPending (переустановка/перевыпуск) для такой
 * записи сам переведёт её на зашифрованный формат.
 */
@Component
public class AesGcmTotpSecretCodec implements TotpSecretCodec {

    private static final String CIPHER_ALGO = "AES/GCM/NoPadding";
    private static final String PREFIX = "v1:";
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final byte[] key;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public AesGcmTotpSecretCodec(@Value("${extree.session-secret}") String sessionSecret) {
        this.key = deriveKey(sessionSecret);
    }

    private static byte[] deriveKey(String secret) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            return sha256.digest(("totp:" + secret).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось вычислить ключ для шифрования TOTP-секрета", e);
        }
    }

    @Override
    public String encrypt(String plainSecret) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(
                    Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertextWithTag = cipher.doFinal(plainSecret.getBytes(StandardCharsets.UTF_8));

            byte[] out = new byte[IV_LENGTH + ciphertextWithTag.length];
            System.arraycopy(iv, 0, out, 0, IV_LENGTH);
            System.arraycopy(ciphertextWithTag, 0, out, IV_LENGTH, ciphertextWithTag.length);
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось зашифровать TOTP-секрет", e);
        }
    }

    @Override
    public String decrypt(String stored) {
        if (stored == null || !stored.startsWith(PREFIX)) {
            return stored;
        }
        try {
            byte[] raw = Base64.getUrlDecoder().decode(stored.substring(PREFIX.length()));
            if (raw.length < IV_LENGTH) {
                return stored;
            }
            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(raw, 0, iv, 0, IV_LENGTH);
            byte[] ciphertextWithTag = new byte[raw.length - IV_LENGTH];
            System.arraycopy(raw, IV_LENGTH, ciphertextWithTag, 0, ciphertextWithTag.length);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(
                    Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] plaintext = cipher.doFinal(ciphertextWithTag);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return stored;
        }
    }
}
