package tech.extree.stats.application.service;

import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorConfig;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;
import tech.extree.stats.application.port.out.TotpRepository;
import tech.extree.stats.application.port.out.TotpSecretCodec;
import tech.extree.stats.domain.TotpSecret;

/**
 * TOTP 2FA: генерация секрета, otpauth:// URL, проверка кода, recovery-коды.
 *
 * GoogleAuthenticator — стандартная библиотека, совместима с
 * Google Authenticator / Authy / 1Password / Bitwarden (RFC 6238).
 * Recovery-коды хешируются SHA-256 и хранятся в JSONB.
 */
@Service
public class TotpService {

    private static final int RECOVERY_CODE_COUNT = 10;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final TotpRepository totpRepository;
    private final TotpSecretCodec totpSecretCodec;
    private final GoogleAuthenticator authenticator;

    public TotpService(TotpRepository totpRepository, TotpSecretCodec totpSecretCodec) {
        this.totpRepository = totpRepository;
        this.totpSecretCodec = totpSecretCodec;
        GoogleAuthenticatorConfig config = new GoogleAuthenticatorConfig.GoogleAuthenticatorConfigBuilder()
                .setWindowSize(1)  // ±30 сек
                .build();
        this.authenticator = new GoogleAuthenticator(config);
    }

    public record SetupResult(String secret, String otpauthUrl, List<String> recoveryCodes) {}

    /** Шаг 1: сгенерировать секрет + recovery-коды, сохранить pending. */
    public SetupResult setup(String userId, String email) {
        GoogleAuthenticatorKey key = authenticator.createCredentials();
        String secret = key.getKey();
        List<String> plainCodes = new ArrayList<>();
        List<String> hashedCodes = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            String code = randomRecoveryCode();
            plainCodes.add(code);
            hashedCodes.add(sha256(code));
        }
        totpRepository.upsertPending(userId, totpSecretCodec.encrypt(secret), hashedCodes);

        String otpauth = String.format(
                "otpauth://totp/Extree%%20Stats:%s?secret=%s&issuer=Extree%%20Stats&algorithm=SHA1&digits=6&period=30",
                urlEncode(email), secret);

        return new SetupResult(secret, otpauth, plainCodes);
    }

    /** Шаг 2: проверить первый код и активировать. */
    public boolean enable(String userId, String code) {
        Optional<TotpSecret> maybe = totpRepository.findByUserId(userId);
        if (maybe.isEmpty() || maybe.get().isEnabled()) return false;
        if (!verifyCode(totpSecretCodec.decrypt(maybe.get().secret()), code)) return false;
        totpRepository.enable(userId, Instant.now());
        return true;
    }

    /** Шаг 3: отключить (требует пароль — на уровне контроллера). */
    public void disable(String userId) {
        totpRepository.delete(userId);
    }

    public boolean isEnabled(String userId) {
        return totpRepository.findByUserId(userId).map(TotpSecret::isEnabled).orElse(false);
    }

    /** Проверка 6-значного TOTP-кода при логине. */
    public boolean verifyCode(String secret, String code) {
        if (code == null) return false;
        try {
            int intCode = Integer.parseInt(code.trim());
            return authenticator.authorize(secret, intCode);
        } catch (NumberFormatException e) {
            return false;
        }
    }

/** Проверка 6-значного TOTP-кода по userId (удобно из LoginService). */
    public boolean verifyCodeForUser(String userId, String code) {
        Optional<TotpSecret> maybe = totpRepository.findByUserId(userId);
        if (maybe.isEmpty() || !maybe.get().isEnabled()) return false;
        return verifyCode(totpSecretCodec.decrypt(maybe.get().secret()), code);
    }

    /** Проверка recovery-кода (одноразовый). Если подошёл — удаляем из БД. */
    public boolean consumeRecoveryCode(String userId, String code) {
        Optional<TotpSecret> maybe = totpRepository.findByUserId(userId);
        if (maybe.isEmpty()) return false;
        String hashed = sha256(code.trim().toLowerCase(Locale.ROOT));
        // Сравниваем со всеми хэшами за время, не зависящее от того, на
        // каком совпал (или не совпал ни с одним) — не .contains(), который
        // использует String.equals() с ранним выходом по байту.
        boolean matched = false;
        for (String stored : maybe.get().recoveryCodesHashed()) {
            if (constantTimeEquals(hashed, stored)) matched = true;
        }
        if (!matched) return false;
        totpRepository.removeRecoveryCode(userId, hashed);
        return true;
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(java.nio.charset.StandardCharsets.UTF_8), b.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public List<String> regenerateRecoveryCodes(String userId) {
        List<String> plain = new ArrayList<>();
        List<String> hashed = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            String c = randomRecoveryCode();
            plain.add(c);
            hashed.add(sha256(c));
        }
        totpRepository.updateRecoveryCodes(userId, hashed);
        return plain;
    }

    /** 12 цифр, тремя группами по 4 ("1234-5678-9012") — та же энтропия
     * (~39.9 бит), что у прежнего 10-символьного hex-кода, но по виду
     * однозначно отличается от TOTP-кода (6 цифр) и легче набирается на
     * телефоне, где не всегда удобно переключаться на буквы/hex. */
    private static String randomRecoveryCode() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 12; i++) {
            if (i > 0 && i % 4 == 0) sb.append('-');
            sb.append(SECURE_RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 недоступен", e);
        }
    }

    private static String urlEncode(String s) {
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }
}